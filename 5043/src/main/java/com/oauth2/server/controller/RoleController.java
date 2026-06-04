package com.oauth2.server.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.oauth2.server.common.Result;
import com.oauth2.server.entity.SysRole;
import com.oauth2.server.entity.SysRolePermission;
import com.oauth2.server.entity.SysUserRole;
import com.oauth2.server.mapper.SysRoleMapper;
import com.oauth2.server.mapper.SysRolePermissionMapper;
import com.oauth2.server.mapper.SysUserRoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
public class RoleController {

    private final SysRoleMapper sysRoleMapper;
    private final SysRolePermissionMapper sysRolePermissionMapper;
    private final SysUserRoleMapper sysUserRoleMapper;

    @GetMapping
    @PreAuthorize("hasAuthority('role:list')")
    public Result<IPage<SysRole>> list(@RequestParam(defaultValue = "1") int current,
                                       @RequestParam(defaultValue = "10") int size,
                                       @RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(SysRole::getRoleCode, keyword)
                    .or().like(SysRole::getRoleName, keyword);
        }
        wrapper.orderByAsc(SysRole::getRoleSort);

        IPage<SysRole> page = sysRoleMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.success(page);
    }

    @GetMapping("/all")
    public Result<List<SysRole>> getAll() {
        LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysRole::getStatus, 1);
        wrapper.orderByAsc(SysRole::getRoleSort);
        return Result.success(sysRoleMapper.selectList(wrapper));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('role:view')")
    public Result<SysRole> getById(@PathVariable Long id) {
        return Result.success(sysRoleMapper.selectById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('role:add')")
    public Result<SysRole> create(@RequestBody SysRole role) {
        sysRoleMapper.insert(role);
        return Result.success(role);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('role:edit')")
    public Result<SysRole> update(@PathVariable Long id, @RequestBody SysRole role) {
        role.setId(id);
        sysRoleMapper.updateById(role);
        return Result.success(role);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('role:delete')")
    @Transactional
    public Result<Void> delete(@PathVariable Long id) {
        sysRoleMapper.deleteById(id);

        LambdaQueryWrapper<SysRolePermission> rpWrapper = new LambdaQueryWrapper<>();
        rpWrapper.eq(SysRolePermission::getRoleId, id);
        sysRolePermissionMapper.delete(rpWrapper);

        LambdaQueryWrapper<SysUserRole> urWrapper = new LambdaQueryWrapper<>();
        urWrapper.eq(SysUserRole::getRoleId, id);
        sysUserRoleMapper.delete(urWrapper);

        return Result.success();
    }

    @PostMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('role:edit')")
    @Transactional
    public Result<Void> assignPermissions(@PathVariable Long id, @RequestBody Set<Long> permissionIds) {
        LambdaQueryWrapper<SysRolePermission> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysRolePermission::getRoleId, id);
        sysRolePermissionMapper.delete(wrapper);

        for (Long permissionId : permissionIds) {
            SysRolePermission rp = new SysRolePermission();
            rp.setRoleId(id);
            rp.setPermissionId(permissionId);
            sysRolePermissionMapper.insert(rp);
        }

        return Result.success();
    }

    @GetMapping("/{id}/permissions")
    public Result<List<Long>> getRolePermissions(@PathVariable Long id) {
        LambdaQueryWrapper<SysRolePermission> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysRolePermission::getRoleId, id);
        List<SysRolePermission> rps = sysRolePermissionMapper.selectList(wrapper);
        List<Long> permissionIds = rps.stream()
                .map(SysRolePermission::getPermissionId)
                .collect(Collectors.toList());
        return Result.success(permissionIds);
    }
}
