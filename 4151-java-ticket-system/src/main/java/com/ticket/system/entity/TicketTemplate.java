package com.ticket.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@Entity
@Table(name = "ticket_template")
@EqualsAndHashCode(callSuper = true)
public class TicketTemplate extends BaseEntity {

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "code", unique = true, length = 50)
    private String code;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_priority", length = 20)
    private Ticket.Priority defaultPriority;

    @Column(name = "default_assignee_id")
    private Long defaultAssigneeId;

    @Column(name = "default_department_id")
    private Long defaultDepartmentId;

    @Column(name = "predefined_title", length = 200)
    private String predefinedTitle;

    @Column(name = "predefined_description", columnDefinition = "TEXT")
    private String predefinedDescription;

    @Column(name = "workflow_steps", columnDefinition = "TEXT")
    private String workflowSteps;

    @Column(name = "required_fields", columnDefinition = "TEXT")
    private String requiredFields;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true;

    @ElementCollection
    @CollectionTable(name = "ticket_template_collaborators", joinColumns = @JoinColumn(name = "template_id"))
    @Column(name = "department_id")
    private List<Long> collaboratorDepartments;
}
