package com.ticket.system.repository;

import com.ticket.system.entity.TicketTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketTemplateRepository extends JpaRepository<TicketTemplate, Long> {

    Optional<TicketTemplate> findByCode(String code);

    List<TicketTemplate> findByCategoryIdAndEnabledTrue(Long categoryId);

    List<TicketTemplate> findByEnabledTrue();

    boolean existsByCode(String code);
}
