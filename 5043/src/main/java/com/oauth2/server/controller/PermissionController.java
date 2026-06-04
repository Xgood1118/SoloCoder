package com.oauth2.server.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.oauth2.server.common.Result;
import com.oauth2.server.entity.SysPermission;
import com.oauth2.server.mapper.SysPermissionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final SysPermissionMapper sysPermissionMapper;

    @GetMapping
    @PreAuthorize("hasAuthority('permission:list')")
    public Result<List<Map<String, Object>>> tree() {
        LambdaQueryWrapper<SysPermission> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysPermission::getStatus, 1);
        wrapper.orderByAsc(SysPermission::getSort);
        List<SysPermission> all = sysPermissionMapper.selectList(wrapper);

        List<Map<String, Object>> tree = buildTree(all, 0L);
        return Result.success(tree);
    }

    @GetMapping("/all")
    public Result<List<SysPermission>> getAll() {
        LambdaQueryWrapper<SysPermission> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysPermission::getStatus, 1);
        wrapper.orderByAsc(SysPermission::getSort);
        return Result.success(sysPermissionMapper.selectList(wrapper));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('permission:view')")
    public Result<SysPermission> getById(@PathVariable Long id) {
        return Result.success(sysPermissionMapper.selectById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('permission:add')")
    public Result<SysPermission> create(@RequestBody SysPermission permission) {
        sysPermissionMapper.insert(permission);
        return Result.success(permission);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('permission:edit')")
    public Result<SysPermission> update(@PathVariable Long id, @RequestBody SysPermission permission) {
        permission.setId(id);
        sysPermissionMapper.updateById(permission);
        return Result.success(permission);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('permission:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        sysPermissionMapper.deleteById(id);
        return Result.success();
    }

    private List<Map<String, Object>> buildTree(List<SysPermission> all, Long parentId) {
        List<Map<String, Object>> result = new ArrayList<>();
        List<SysPermission> children = all.stream()
                .filter(p -> parentId.equals(p.getParentId()))
                .collect(Collectors.toList());

        for (SysPermission p : children) {
            Map<String, Object> node = new HashMap<>();
            node.put("id", p.getId());
            node.put("permissionCode", p.getPermissionCode());
            node.put("permissionName", p.getPermissionName());
            node.put("resourceType", p.getResourceType());
            node.put("resourceUrl", p.getResourceUrl());
            node.put("resourceMethod", p.getResourceMethod());
            node.put("sort", p.getSort());
            node.put("children", buildTree(all, p.getId()));
            result.add(node);
        }

        return result;
    }
}
