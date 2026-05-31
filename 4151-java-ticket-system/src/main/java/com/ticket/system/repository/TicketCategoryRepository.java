package com.ticket.system.repository;

import com.ticket.system.entity.TicketCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketCategoryRepository extends JpaRepository<TicketCategory, Long>, JpaSpecificationExecutor<TicketCategory> {

    Optional<TicketCategory> findByCode(String code);

    List<TicketCategory> findByParentIdAndEnabledTrue(Long parentId);

    @Query("SELECT c FROM TicketCategory c WHERE c.parentId IS NULL AND c.enabled = true ORDER BY c.sortOrder")
    List<TicketCategory> findRootCategories();

    List<TicketCategory> findByLevelAndEnabledTrue(Integer level);

    List<TicketCategory> findByDefaultAssigneeIdAndEnabledTrue(Long assigneeId);

    boolean existsByCode(String code);
}
