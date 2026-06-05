package com.cms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateCreateRequest {

    private String name;
    private String description;
    private String categoryId;
    private String structure;
    private Boolean isDefault;
}
