package com.cms.controller;

import com.cms.dto.ApiResponse;
import com.cms.dto.CommentDTO;
import com.cms.dto.CreateCommentRequest;
import com.cms.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping("/document/{documentId}")
    public ApiResponse<List<CommentDTO>> getCommentsByDocumentId(@PathVariable String documentId) {
        return ApiResponse.success(commentService.getCommentsByDocumentId(documentId));
    }

    @PostMapping("/document/{documentId}")
    public ApiResponse<CommentDTO> createComment(@PathVariable String documentId,
                                                 @RequestBody CreateCommentRequest request,
                                                 @RequestParam(required = false, defaultValue = "1") String userId) {
        request.setDocumentId(documentId);
        return ApiResponse.success(commentService.createComment(request, userId));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteComment(@PathVariable String id,
                                           @RequestParam(required = false) String userId,
                                           @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {
        String actualUserId = userId != null ? userId : (headerUserId != null ? headerUserId : "1");
        commentService.deleteComment(id, actualUserId);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/like")
    public ApiResponse<Void> likeComment(@PathVariable String id) {
        commentService.likeComment(id);
        return ApiResponse.success();
    }

    @ExceptionHandler(RuntimeException.class)
    public ApiResponse<Void> handleRuntimeException(RuntimeException e) {
        return ApiResponse.error(e.getMessage(), 400);
    }

    @ExceptionHandler(Exception.class)
    public ApiResponse<Void> handleException(Exception e) {
        return ApiResponse.error("Internal server error", 500);
    }
}
