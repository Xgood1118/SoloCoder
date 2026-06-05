package com.cms.controller;

import com.cms.dto.ApiResponse;
import com.cms.dto.PageResponse;
import com.cms.dto.ReviewActionRequest;
import com.cms.dto.ReviewRecordDTO;
import com.cms.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping("/submit/{documentId}")
    public ApiResponse<ReviewRecordDTO> submitForReview(@PathVariable String documentId) {
        return ApiResponse.success(reviewService.submitForReview(documentId));
    }

    @PostMapping("/approve")
    public ApiResponse<ReviewRecordDTO> approveReview(@RequestBody ReviewActionRequest request,
                                                      @RequestParam(required = false, defaultValue = "1") String reviewerId) {
        return ApiResponse.success(reviewService.approveReview(request, reviewerId));
    }

    @PostMapping("/reject")
    public ApiResponse<ReviewRecordDTO> rejectReview(@RequestBody ReviewActionRequest request,
                                                     @RequestParam(required = false, defaultValue = "1") String reviewerId) {
        return ApiResponse.success(reviewService.rejectReview(request, reviewerId));
    }

    @PostMapping("/resubmit/{documentId}")
    public ApiResponse<Void> resubmitForReview(@PathVariable String documentId) {
        reviewService.resubmitForReview(documentId);
        return ApiResponse.success();
    }

    @GetMapping("/history/{documentId}")
    public ApiResponse<List<ReviewRecordDTO>> getReviewHistory(@PathVariable String documentId) {
        return ApiResponse.success(reviewService.getReviewHistory(documentId));
    }

    @GetMapping("/pending/{reviewerId}/{level}")
    public ApiResponse<PageResponse<ReviewRecordDTO>> getPendingReviews(
            @PathVariable String reviewerId,
            @PathVariable int level,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(reviewService.getPendingReviews(reviewerId, level, page, pageSize));
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
