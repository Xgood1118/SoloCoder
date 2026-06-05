package com.cms.dto;

import com.cms.entity.DocumentStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentFilterRequest {

    private String keyword;
    private String categoryId;
    private List<String> tagIds;
    private DocumentStatus status;
    private String authorId;
    private String accessLevel;
    private LocalDateTime createdFrom;
    private LocalDateTime createdTo;
    private LocalDateTime updatedFrom;
    private LocalDateTime updatedTo;
    private Integer page = 1;
    private Integer pageSize = 20;
    private String sortField = "createdAt";
    private String sortDirection = "DESC";
}
