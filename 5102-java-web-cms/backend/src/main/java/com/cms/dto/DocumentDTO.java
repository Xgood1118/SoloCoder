package com.cms.dto;

import com.cms.entity.AccessLevel;
import com.cms.entity.DocumentStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentDTO {

    private String id;
    private String title;
    private String content;
    private String categoryId;
    private String authorId;
    private DocumentStatus status;
    private AccessLevel accessLevel;
    private Integer viewCount;
    private Boolean allowComments;
    private List<TagDTO> tags = new ArrayList<>();
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
