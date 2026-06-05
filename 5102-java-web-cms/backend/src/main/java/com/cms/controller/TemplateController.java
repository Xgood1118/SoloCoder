package com.cms.controller;

import com.cms.dto.ApiResponse;
import com.cms.dto.DocumentTemplateDTO;
import com.cms.dto.TemplateCreateRequest;
import com.cms.dto.TemplateUpdateRequest;
import com.cms.service.DocumentTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final DocumentTemplateService documentTemplateService;

    @GetMapping("")
    public ApiResponse<List<DocumentTemplateDTO>> getAllTemplates() {
        return ApiResponse.success(documentTemplateService.getAllTemplates());
    }

    @GetMapping("/category/{categoryId}")
    public ApiResponse<List<DocumentTemplateDTO>> getTemplatesByCategory(@PathVariable String categoryId) {
        return ApiResponse.success(documentTemplateService.getTemplatesByCategory(categoryId));
    }

    @GetMapping("/{id}")
    public ApiResponse<DocumentTemplateDTO> getTemplateById(@PathVariable String id) {
        return ApiResponse.success(documentTemplateService.getTemplateById(id));
    }

    @PostMapping("")
    public ApiResponse<DocumentTemplateDTO> createTemplate(@RequestBody TemplateCreateRequest request,
                                                           @RequestParam(required = false, defaultValue = "1") String userId) {
        return ApiResponse.success(documentTemplateService.createTemplate(request, userId));
    }

    @PutMapping("/{id}")
    public ApiResponse<DocumentTemplateDTO> updateTemplate(@PathVariable String id,
                                                           @RequestBody TemplateUpdateRequest request) {
        return ApiResponse.success(documentTemplateService.updateTemplate(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteTemplate(@PathVariable String id) {
        documentTemplateService.deleteTemplate(id);
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
