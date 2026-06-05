package com.cms.controller;

import com.cms.dto.ApiResponse;
import com.cms.dto.UserDTO;
import com.cms.entity.User;
import com.cms.entity.UserRole;
import com.cms.service.UserService;
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
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("")
    public ApiResponse<List<UserDTO>> getAllUsers() {
        return ApiResponse.success(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ApiResponse<UserDTO> getUserById(@PathVariable String id) {
        return ApiResponse.success(userService.getUserById(id));
    }

    @PostMapping("")
    public ApiResponse<UserDTO> createUser(@RequestBody User user) {
        return ApiResponse.success(userService.createUser(user));
    }

    @PutMapping("/{id}")
    public ApiResponse<UserDTO> updateUser(@PathVariable String id, @RequestBody User user) {
        return ApiResponse.success(userService.updateUser(id, user));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ApiResponse.success();
    }

    @GetMapping("/role/{role}")
    public ApiResponse<List<UserDTO>> getUsersByRole(@PathVariable String role) {
        UserRole userRole = UserRole.valueOf(role.toUpperCase());
        return ApiResponse.success(userService.getUsersByRole(userRole));
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
