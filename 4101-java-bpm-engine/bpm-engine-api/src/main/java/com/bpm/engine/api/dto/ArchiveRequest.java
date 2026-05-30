package com.bpm.engine.api.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ArchiveRequest {

    private LocalDateTime before;
    private Integer batchSize;
}
