package com.ticket.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@Entity
@Table(name = "ticket_attachment")
@EqualsAndHashCode(callSuper = true)
public class TicketAttachment extends BaseEntity {

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Column(name = "comment_id")
    private Long commentId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "original_name", length = 255)
    private String originalName;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Column(name = "file_type", length = 50)
    private String fileType;

    @Column(name = "previewable", nullable = false)
    private Boolean previewable = false;

    @Column(name = "preview_path", length = 500)
    private String previewPath;
}
