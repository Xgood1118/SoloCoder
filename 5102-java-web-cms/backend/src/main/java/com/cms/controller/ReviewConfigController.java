package com.cms.controller;

import com.cms.dto.ApiResponse;
import com.cms.dto.ReviewConfigCreateRequest;
import com.cms.dto.ReviewConfigDTO;
import com.cms.dto.ReviewConfigUpdateRequest;
import com.cms.service.ReviewConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/review-configs")
@RequiredArgsConstructor
public class ReviewConfigController {

    private final ReviewConfigService reviewConfigService;

    @GetMapping
    public ApiResponse<List<ReviewConfigDTO>> getAllConfigs() {
        return ApiResponse.success(reviewConfigService.getAllConfigs());
    }

    @GetMapping("/category/{categoryId}")
    public ApiResponse<ReviewConfigDTO> getConfigByCategory(@PathVariable String categoryId) {
        return ApiResponse.success(reviewConfigService.getConfigByCategory(categoryId));
    }

    @PostMapping
    public ApiResponse<ReviewConfigDTO> createConfig(@RequestBody ReviewConfigCreateRequest request) {
        return ApiResponse.success(reviewConfigService.createConfig(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<ReviewConfigDTO> updateConfig(@PathVariable String id, @RequestBody ReviewConfigUpdateRequest request) {
        return ApiResponse.success(reviewConfigService.updateConfig(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteConfig(@PathVariable String id) {
        reviewConfigService.deleteConfig(id);
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
