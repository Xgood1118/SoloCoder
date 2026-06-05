package com.cms.controller;

import com.cms.dto.ApiResponse;
import com.cms.dto.PageResponse;
import com.cms.dto.TagDTO;
import com.cms.entity.Tag;
import com.cms.service.TagService;
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
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @GetMapping("")
    public ApiResponse<PageResponse<TagDTO>> getTags(
            @RequestParam(required = false) String name,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(tagService.getTags(name, page, pageSize));
    }

    @GetMapping("/search")
    public ApiResponse<List<TagDTO>> searchTags(@RequestParam String name) {
        return ApiResponse.success(tagService.searchTags(name));
    }

    @GetMapping("/{id}")
    public ApiResponse<TagDTO> getTagById(@PathVariable String id) {
        return ApiResponse.success(tagService.getTagById(id));
    }

    @PostMapping("")
    public ApiResponse<TagDTO> createTag(@RequestBody Tag tag) {
        return ApiResponse.success(tagService.createTag(tag));
    }

    @PutMapping("/{id}")
    public ApiResponse<TagDTO> updateTag(@PathVariable String id, @RequestBody Tag tag) {
        return ApiResponse.success(tagService.updateTag(id, tag));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteTag(@PathVariable String id) {
        tagService.deleteTag(id);
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
