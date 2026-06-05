package com.cms.dto;

import com.cms.entity.AccessLevel;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DocumentCreateRequest {

    private String title;
    private String content;
    private String categoryId;
    private AccessLevel accessLevel;
    private List<String> tagIds;
    private String templateId;
    private Boolean allowComments;
}
