package com.landnexus.landrecords.infrastructure;

import com.landnexus.landrecords.domain.Landowner;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface LandownerRepository extends JpaRepository<Landowner, UUID>, JpaSpecificationExecutor<Landowner> {
}