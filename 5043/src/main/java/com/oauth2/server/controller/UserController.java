package com.oauth2.server.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.oauth2.server.common.Result;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.entity.SysUser;
import com.oauth2.server.mapper.SysUserMapper;
import com.oauth2.server.service.DataPermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final SysUserMapper sysUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final DataPermissionService dataPermissionService;

    @GetMapping
    @PreAuthorize("hasAuthority('user:list')")
    public Result<IPage<SysUser>> list(@RequestParam(defaultValue = "1") int current,
                                       @RequestParam(defaultValue = "10") int size,
                                       @RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(SysUser::getUsername, keyword)
                    .or().like(SysUser::getNickname, keyword);
        }
        wrapper.orderByDesc(SysUser::getCreateTime);

        IPage<SysUser> page = sysUserMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.success(page);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('user:view')")
    public Result<SysUser> getById(@PathVariable Long id) {
        SysUser user = sysUserMapper.selectById(id);
        if (user != null) {
            user.setPassword(null);
        }
        return Result.success(user);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('user:add')")
    public Result<SysUser> create(@RequestBody SysUser user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        sysUserMapper.insert(user);
        user.setPassword(null);
        return Result.success(user);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user:edit')")
    public Result<SysUser> update(@PathVariable Long id, @RequestBody SysUser user) {
        user.setId(id);
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        } else {
            user.setPassword(null);
        }
        sysUserMapper.updateById(user);
        return Result.success(user);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        sysUserMapper.deleteById(id);
        return Result.success();
    }

    @GetMapping("/current")
    public Result<Map<String, Object>> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof LoginUserDTO user)) {
            return Result.error(401, "Not authenticated");
        }

        return Result.success(Map.of(
                "userId", user.getUserId(),
                "username", user.getUsername(),
                "nickname", user.getNickname(),
                "roles", user.getRoles(),
                "permissions", user.getPermissions()
        ));
    }

    @GetMapping("/list-by-dept")
    @PreAuthorize("hasAuthority('user:list')")
    public Result<List<SysUser>> listByDept(@RequestParam Long deptId) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysUser::getDeptId, deptId);
        wrapper.eq(SysUser::getStatus, 1);
        List<SysUser> users = sysUserMapper.selectList(wrapper);
        users.forEach(u -> u.setPassword(null));
        return Result.success(users);
    }
}
