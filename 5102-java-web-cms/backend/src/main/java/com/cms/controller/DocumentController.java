package com.cms.controller;

import com.cms.dto.ApiResponse;
import com.cms.dto.DocumentCreateRequest;
import com.cms.dto.DocumentDTO;
import com.cms.dto.DocumentFilterRequest;
import com.cms.dto.DocumentUpdateRequest;
import com.cms.dto.PageResponse;
import com.cms.dto.SubmitReviewRequest;
import com.cms.service.DocumentService;
import com.cms.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final ReviewService reviewService;

    @GetMapping("")
    public ApiResponse<PageResponse<DocumentDTO>> getDocuments(@ModelAttribute DocumentFilterRequest filter) {
        return ApiResponse.success(documentService.getDocuments(filter));
    }

    @GetMapping("/{id}")
    public ApiResponse<DocumentDTO> getDocumentById(@PathVariable String id) {
        return ApiResponse.success(documentService.getDocumentById(id));
    }

    @PostMapping("")
    public ApiResponse<DocumentDTO> createDocument(@RequestBody DocumentCreateRequest request,
                                                   @RequestParam(required = false, defaultValue = "1") String authorId) {
        return ApiResponse.success(documentService.createDocument(request, authorId));
    }

    @PutMapping("/{id}")
    public ApiResponse<DocumentDTO> updateDocument(@PathVariable String id,
                                                   @RequestBody DocumentUpdateRequest request) {
        return ApiResponse.success(documentService.updateDocument(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteDocument(@PathVariable String id) {
        documentService.deleteDocument(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/submit-review")
    public ApiResponse<Void> submitForReview(@PathVariable String id,
                                             @RequestBody(required = false) SubmitReviewRequest request) {
        reviewService.submitForReview(id);
        return ApiResponse.success();
    }

    @GetMapping("/pending-review/{reviewerId}/{level}")
    public ApiResponse<PageResponse<DocumentDTO>> getPendingReviewDocuments(
            @PathVariable String reviewerId,
            @PathVariable int level,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(documentService.getPendingReviewDocuments(reviewerId, level, page, pageSize));
    }

    @GetMapping("/tag/{tagId}")
    public ApiResponse<List<DocumentDTO>> getDocumentsByTagId(@PathVariable String tagId) {
        return ApiResponse.success(documentService.getDocumentsByTagId(tagId));
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
