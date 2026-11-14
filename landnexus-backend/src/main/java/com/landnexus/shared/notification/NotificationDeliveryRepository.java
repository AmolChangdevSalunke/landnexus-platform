package com.landnexus.shared.notification;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, UUID> {

    boolean existsByNotificationIdAndChannel(UUID notificationId, NotificationChannel channel);

    List<NotificationDelivery> findByNotificationIdOrderByCreatedAtAsc(UUID notificationId);

    Page<NotificationDelivery> findByStatus(DeliveryStatus status, Pageable pageable);

    /** Identifiers that are due now. Each one is locked again before it is actually sent. */
    @Query("""
            select d.id from NotificationDelivery d
            where d.status in :statuses and d.nextAttemptAt is not null and d.nextAttemptAt <= :now
            order by d.nextAttemptAt asc
            """)
    List<UUID> findDueIds(@Param("statuses") List<DeliveryStatus> statuses,
                          @Param("now") Instant now,
                          Pageable pageable);

    /** Locks one row for the duration of the attempt, preventing a duplicate send. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from NotificationDelivery d where d.id = :id")
    Optional<NotificationDelivery> findByIdForUpdate(@Param("id") UUID id);
}
