package com.cms.dto;

import com.cms.entity.UserRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReviewConfigDTO {

    private String id;
    private String categoryId;
    private String categoryName;
    private Integer reviewLevels;
    private UserRole level1ReviewerRole;
    private UserRole level2ReviewerRole;
    private Boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
