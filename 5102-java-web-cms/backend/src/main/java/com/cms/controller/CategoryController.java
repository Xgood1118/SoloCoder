package com.cms.controller;

import com.cms.dto.ApiResponse;
import com.cms.dto.CategoryDTO;
import com.cms.entity.Category;
import com.cms.service.CategoryService;
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

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping("/tree")
    public ApiResponse<List<CategoryDTO>> getCategoryTree() {
        return ApiResponse.success(categoryService.getCategoryTree());
    }

    @GetMapping("")
    public ApiResponse<List<CategoryDTO>> getAllCategories() {
        List<CategoryDTO> tree = categoryService.getCategoryTree();
        List<CategoryDTO> flatList = new ArrayList<>();
        flattenCategories(tree, flatList);
        return ApiResponse.success(flatList);
    }

    private void flattenCategories(List<CategoryDTO> categories, List<CategoryDTO> flatList) {
        for (CategoryDTO dto : categories) {
            flatList.add(dto);
            if (dto.getChildren() != null && !dto.getChildren().isEmpty()) {
                flattenCategories(dto.getChildren(), flatList);
            }
        }
    }

    @GetMapping("/{id}")
    public ApiResponse<CategoryDTO> getCategoryById(@PathVariable String id) {
        return ApiResponse.success(categoryService.getCategoryById(id));
    }

    @PostMapping("")
    public ApiResponse<CategoryDTO> createCategory(@RequestBody Category category) {
        return ApiResponse.success(categoryService.createCategory(category));
    }

    @PutMapping("/{id}")
    public ApiResponse<CategoryDTO> updateCategory(@PathVariable String id, @RequestBody Category category) {
        return ApiResponse.success(categoryService.updateCategory(id, category));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteCategory(@PathVariable String id,
                                            @RequestParam(defaultValue = "false") boolean moveDocumentsToRoot) {
        categoryService.deleteCategory(id, moveDocumentsToRoot);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/move")
    public ApiResponse<Void> moveCategory(@PathVariable String id,
                                          @RequestParam String newParentId) {
        categoryService.moveCategory(id, newParentId);
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
