package com.ticket.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "ticket_category")
@EqualsAndHashCode(callSuper = true)
public class TicketCategory extends BaseEntity {

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "code", unique = true, length = 50)
    private String code;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "level", nullable = false)
    private Integer level = 1;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "default_assignee_id")
    private Long defaultAssigneeId;

    @Column(name = "default_department_id")
    private Long defaultDepartmentId;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "parent_id")
    private List<TicketCategory> children = new ArrayList<>();
}
