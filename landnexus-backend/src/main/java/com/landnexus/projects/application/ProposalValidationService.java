package com.landnexus.projects.application;

import com.landnexus.projects.domain.Proposal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ProposalValidationService {

    public record ValidationItem(String code, String severity, String message) {}
    public record ValidationResult(boolean passed, List<ValidationItem> items) {
        public boolean hasFailures() {
            return items.stream().anyMatch(i -> "FAIL".equals(i.severity()));
        }
    }

    public ValidationResult validate(Proposal proposal) {
        List<ValidationItem> items = new ArrayList<>();

        requireText(items, "TITLE", proposal.getTitle(), "Proposal title is required.");
        requireText(items, "DESCRIPTION", proposal.getDescription(), "Proposal description is required.");
        if (proposal.getEstimatedLandAreaHa() == null || proposal.getEstimatedLandAreaHa().signum() <= 0) {
            items.add(new ValidationItem("LAND_AREA", "FAIL", "Estimated land area must be greater than zero."));
        } else {
            items.add(new ValidationItem("LAND_AREA", "PASS", "Estimated land area is provided."));
        }
        if (proposal.getProjectType() != null && proposal.getProjectType().isLinear() && proposal.getLengthKm() == null) {
            items.add(new ValidationItem("LENGTH_KM", "FAIL", "Length (km) is required for linear projects."));
        } else if (proposal.getProjectType() != null && proposal.getProjectType().isLinear()) {
            items.add(new ValidationItem("LENGTH_KM", "PASS", "Length (km) is provided for linear project."));
        }
        if (proposal.getDistrictId() == null || proposal.getStateId() == null) {
            items.add(new ValidationItem("LOCATION", "FAIL", "State and district information is required."));
        } else {
            items.add(new ValidationItem("LOCATION", "PASS", "Project location information is present."));
        }
        if (proposal.getVillageIds() == null || proposal.getVillageIds().isEmpty()) {
            items.add(new ValidationItem("VILLAGES", "FAIL", "At least one affected village must be selected."));
        } else {
            items.add(new ValidationItem("VILLAGES", "PASS", proposal.getVillageIds().size() + " affected village(s) selected."));
        }
        if (proposal.getDepartmentId() == null) {
            items.add(new ValidationItem("DEPARTMENT", "FAIL", "Department is required."));
        } else {
            items.add(new ValidationItem("DEPARTMENT", "PASS", "Department is selected."));
        }
        if (proposal.getPlannedStartDate() == null || proposal.getPlannedEndDate() == null
                || !proposal.getPlannedEndDate().isAfter(proposal.getPlannedStartDate())) {
            items.add(new ValidationItem("SCHEDULE", "FAIL", "Planned end date must be after planned start date."));
        } else {
            items.add(new ValidationItem("SCHEDULE", "PASS", "Planned schedule is valid."));
        }
        if (proposal.getAlignmentDescription() == null || proposal.getAlignmentDescription().isBlank()) {
            items.add(new ValidationItem("ALIGNMENT", "WARN", "Alignment description is not provided. Add alignment details if available."));
        } else {
            items.add(new ValidationItem("ALIGNMENT", "PASS", "Alignment description is provided."));
        }
        // Proposal-level document association is not yet implemented in this codebase.
        items.add(new ValidationItem("SUPPORTING_DOCUMENTS", "WARN",
                "Proposal-level supporting document association is not yet available. Ensure required documents are maintained in the relevant records before scrutiny."));

        boolean passed = items.stream().noneMatch(i -> "FAIL".equals(i.severity()));
        return new ValidationResult(passed, List.copyOf(items));
    }

    private static void requireText(List<ValidationItem> items, String code, String value, String failMessage) {
        if (value == null || value.isBlank()) {
            items.add(new ValidationItem(code, "FAIL", failMessage));
        } else {
            items.add(new ValidationItem(code, "PASS", code.replace('_', ' ').charAt(0) + code.replace('_', ' ').substring(1).toLowerCase() + " is provided."));
        }
    }
}
