package com.ticket.system.controller;

import com.ticket.system.dto.TicketStatisticsDTO;
import com.ticket.system.entity.Ticket;
import com.ticket.system.entity.TicketComment;
import com.ticket.system.entity.TicketTransfer;
import com.ticket.system.service.ExportService;
import com.ticket.system.service.StatisticsService;
import com.ticket.system.service.TicketCommentService;
import com.ticket.system.service.TicketService;
import com.ticket.system.statemachine.TicketStatusEvent;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;
    private final TicketCommentService commentService;
    private final StatisticsService statisticsService;
    private final ExportService exportService;

    @PostMapping
    public ResponseEntity<Ticket> createTicket(@Valid @RequestBody CreateTicketRequest request) {
        Ticket ticket = new Ticket();
        ticket.setTitle(request.getTitle());
        ticket.setDescription(request.getDescription());
        ticket.setCategoryId(request.getCategoryId());
        ticket.setRequesterId(request.getRequesterId());
        ticket.setPriority(request.getPriority());
        ticket.setSource(request.getSource());
        ticket.setTemplateId(request.getTemplateId());
        
        Ticket created = ticketService.createTicket(ticket);
        return ResponseEntity.ok(created);
    }

    @GetMapping("/{ticketId}")
    public ResponseEntity<Ticket> getTicket(@PathVariable Long ticketId) {
        Ticket ticket = ticketService.getTicketById(ticketId);
        return ResponseEntity.ok(ticket);
    }

    @PutMapping("/{ticketId}/status")
    public ResponseEntity<Ticket> updateStatus(
            @PathVariable Long ticketId,
            @RequestBody StatusUpdateRequest request) {
        Ticket updated = ticketService.updateStatus(ticketId, request.getEvent(), request.getOperatorId());
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{ticketId}/assign")
    public ResponseEntity<Ticket> assignTicket(
            @PathVariable Long ticketId,
            @RequestBody AssignRequest request) {
        Ticket updated = ticketService.assignTicket(ticketId, request.getAssigneeId(), request.getAssignerId());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{ticketId}/transfer")
    public ResponseEntity<TicketTransfer> transferTicket(
            @PathVariable Long ticketId,
            @RequestBody TransferRequest request) {
        TicketTransfer transfer = ticketService.transferTicket(
                ticketId, request.getFromUserId(), request.getToUserId(), request.getReason());
        return ResponseEntity.ok(transfer);
    }

    @PostMapping("/transfers/{transferId}/confirm")
    public ResponseEntity<TicketTransfer> confirmTransfer(
            @PathVariable Long transferId,
            @RequestBody ConfirmTransferRequest request) {
        TicketTransfer confirmed = ticketService.confirmTransfer(
                transferId, request.getUserId(), request.isAccepted(), request.getRemark());
        return ResponseEntity.ok(confirmed);
    }

    @PostMapping("/{ticketId}/remind")
    public ResponseEntity<Ticket> remindTicket(
            @PathVariable Long ticketId,
            @RequestBody RemindRequest request) {
        Ticket reminded = ticketService.remindTicket(ticketId, request.getUserId());
        return ResponseEntity.ok(reminded);
    }

    @PostMapping("/{ticketId}/solution")
    public ResponseEntity<Ticket> submitSolution(
            @PathVariable Long ticketId,
            @RequestBody SolutionRequest request) {
        Ticket updated = ticketService.submitSolution(ticketId, request.getSolution(), request.getOperatorId());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{ticketId}/accept")
    public ResponseEntity<Ticket> acceptSolution(
            @PathVariable Long ticketId,
            @RequestBody OperatorRequest request) {
        Ticket updated = ticketService.acceptSolution(ticketId, request.getOperatorId());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{ticketId}/reject")
    public ResponseEntity<Ticket> rejectSolution(
            @PathVariable Long ticketId,
            @RequestBody RejectSolutionRequest request) {
        Ticket updated = ticketService.rejectSolution(ticketId, request.getReason(), request.getOperatorId());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{ticketId}/cancel")
    public ResponseEntity<Ticket> cancelTicket(
            @PathVariable Long ticketId,
            @RequestBody CancelRequest request) {
        Ticket updated = ticketService.cancelTicket(ticketId, request.getReason(), request.getOperatorId());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{ticketId}/satisfaction")
    public ResponseEntity<Ticket> evaluateSatisfaction(
            @PathVariable Long ticketId,
            @RequestBody SatisfactionRequest request) {
        Ticket updated = ticketService.evaluateSatisfaction(ticketId, request.getScore(), request.getComment());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{ticketId}/reopen")
    public ResponseEntity<Ticket> reopenTicket(
            @PathVariable Long ticketId,
            @RequestBody ReopenRequest request) {
        Ticket reopened = ticketService.reopenTicket(ticketId, request.getReason(), request.getOperatorId());
        return ResponseEntity.ok(reopened);
    }

    @PostMapping("/{ticketId}/comments")
    public ResponseEntity<TicketComment> addComment(
            @PathVariable Long ticketId,
            @RequestBody AddCommentRequest request) {
        TicketComment comment = commentService.addComment(
                ticketId, request.getAuthorId(), request.getContent(),
                request.getType(), request.getVisibility());
        return ResponseEntity.ok(comment);
    }

    @PostMapping("/{ticketId}/replies")
    public ResponseEntity<TicketComment> addReply(
            @PathVariable Long ticketId,
            @RequestBody AddReplyRequest request) {
        TicketComment comment = commentService.addReply(ticketId, request.getAuthorId(), request.getContent());
        return ResponseEntity.ok(comment);
    }

    @PostMapping("/{ticketId}/internal-notes")
    public ResponseEntity<TicketComment> addInternalNote(
            @PathVariable Long ticketId,
            @RequestBody AddReplyRequest request) {
        TicketComment comment = commentService.addInternalNote(ticketId, request.getAuthorId(), request.getContent());
        return ResponseEntity.ok(comment);
    }

    @GetMapping("/{ticketId}/comments")
    public ResponseEntity<List<TicketComment>> getComments(@PathVariable Long ticketId) {
        List<TicketComment> comments = commentService.getTicketComments(ticketId);
        return ResponseEntity.ok(comments);
    }

    @GetMapping("/{ticketId}/comments/public")
    public ResponseEntity<List<TicketComment>> getPublicComments(@PathVariable Long ticketId) {
        List<TicketComment> comments = commentService.getPublicComments(ticketId);
        return ResponseEntity.ok(comments);
    }

    @GetMapping("/statistics")
    public ResponseEntity<TicketStatisticsDTO> getStatistics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        TicketStatisticsDTO stats = statisticsService.getOverallStatistics(start, end);
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/statistics/assignee/{assigneeId}")
    public ResponseEntity<TicketStatisticsDTO> getStatisticsByAssignee(
            @PathVariable Long assigneeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        TicketStatisticsDTO stats = statisticsService.getStatisticsByAssignee(assigneeId, start, end);
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportTickets(
            @RequestParam(required = false) List<Long> ticketIds,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) throws IOException {
        
        byte[] excelData;
        String filename;
        
        if (start != null && end != null) {
            excelData = exportService.exportTicketsByDateRange(start, end);
            filename = String.format("tickets_%s_%s.xlsx", 
                    start.toLocalDate(), end.toLocalDate());
        } else {
            excelData = exportService.exportTicketsToExcel(ticketIds);
            filename = "tickets_export.xlsx";
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(excelData);
    }

    @GetMapping("/requester/{requesterId}")
    public ResponseEntity<List<Ticket>> getTicketsByRequester(@PathVariable Long requesterId) {
        List<Ticket> tickets = ticketService.getTicketsByRequester(requesterId);
        return ResponseEntity.ok(tickets);
    }

    @GetMapping("/assignee/{assigneeId}")
    public ResponseEntity<List<Ticket>> getTicketsByAssignee(@PathVariable Long assigneeId) {
        List<Ticket> tickets = ticketService.getTicketsByAssignee(assigneeId);
        return ResponseEntity.ok(tickets);
    }

    @Data
    public static class CreateTicketRequest {
        @NotBlank(message = "Title is required")
        private String title;
        private String description;
        @NotNull(message = "Category ID is required")
        private Long categoryId;
        @NotNull(message = "Requester ID is required")
        private Long requesterId;
        private Ticket.Priority priority;
        private Ticket.Source source;
        private Long templateId;
    }

    @Data
    public static class StatusUpdateRequest {
        @NotNull(message = "Event is required")
        private TicketStatusEvent event;
        @NotNull(message = "Operator ID is required")
        private Long operatorId;
    }

    @Data
    public static class AssignRequest {
        @NotNull(message = "Assignee ID is required")
        private Long assigneeId;
        @NotNull(message = "Assigner ID is required")
        private Long assignerId;
    }

    @Data
    public static class TransferRequest {
        @NotNull(message = "From user ID is required")
        private Long fromUserId;
        @NotNull(message = "To user ID is required")
        private Long toUserId;
        @NotBlank(message = "Reason is required")
        private String reason;
    }

    @Data
    public static class ConfirmTransferRequest {
        @NotNull(message = "User ID is required")
        private Long userId;
        private boolean accepted;
        private String remark;
    }

    @Data
    public static class RemindRequest {
        @NotNull(message = "User ID is required")
        private Long userId;
    }

    @Data
    public static class SolutionRequest {
        @NotBlank(message = "Solution is required")
        private String solution;
        @NotNull(message = "Operator ID is required")
        private Long operatorId;
    }

    @Data
    public static class OperatorRequest {
        @NotNull(message = "Operator ID is required")
        private Long operatorId;
    }

    @Data
    public static class RejectSolutionRequest {
        private String reason;
        @NotNull(message = "Operator ID is required")
        private Long operatorId;
    }

    @Data
    public static class CancelRequest {
        private String reason;
        @NotNull(message = "Operator ID is required")
        private Long operatorId;
    }

    @Data
    public static class SatisfactionRequest {
        private Integer score;
        private String comment;
    }

    @Data
    public static class ReopenRequest {
        private String reason;
        @NotNull(message = "Operator ID is required")
        private Long operatorId;
    }

    @Data
    public static class AddCommentRequest {
        @NotNull(message = "Author ID is required")
        private Long authorId;
        @NotBlank(message = "Content is required")
        private String content;
        @NotNull(message = "Type is required")
        private TicketComment.CommentType type;
        @NotNull(message = "Visibility is required")
        private TicketComment.Visibility visibility;
    }

    @Data
    public static class AddReplyRequest {
        @NotNull(message = "Author ID is required")
        private Long authorId;
        @NotBlank(message = "Content is required")
        private String content;
    }
}
