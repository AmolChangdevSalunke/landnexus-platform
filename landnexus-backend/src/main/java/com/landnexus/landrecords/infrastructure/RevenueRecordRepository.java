package com.landnexus.landrecords.infrastructure;

import com.landnexus.landrecords.domain.LandTypes.RevenueRecordType;
import com.landnexus.landrecords.domain.RevenueRecord;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RevenueRecordRepository extends JpaRepository<RevenueRecord, UUID> {

    List<RevenueRecord> findByParcelIdOrderByExtractDateDesc(UUID parcelId);

    boolean existsByParcelIdAndRecordTypeAndExtractDate(UUID parcelId, RevenueRecordType recordType, LocalDate extractDate);
}