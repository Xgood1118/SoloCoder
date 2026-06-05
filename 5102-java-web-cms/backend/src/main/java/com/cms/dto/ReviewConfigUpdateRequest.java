package com.cms.dto;

import com.cms.entity.UserRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReviewConfigUpdateRequest {

    private Integer reviewLevels;
    private UserRole level1ReviewerRole;
    private UserRole level2ReviewerRole;
    private Boolean enabled;
}
