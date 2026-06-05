package com.cms.dto;

import com.cms.entity.ReviewStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReviewRecordDTO {

    private String id;
    private String documentId;
    private String documentTitle;
    private String reviewerId;
    private String reviewerName;
    private Integer level;
    private ReviewStatus status;
    private String comment;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
