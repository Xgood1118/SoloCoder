package com.oauth2.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.entity.SysDept;
import com.oauth2.server.entity.SysUser;
import com.oauth2.server.mapper.SysDeptMapper;
import com.oauth2.server.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final SysUserMapper sysUserMapper;
    private final SysDeptMapper sysDeptMapper;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysUser::getUsername, username);
        wrapper.eq(SysUser::getStatus, 1);
        SysUser user = sysUserMapper.selectOne(wrapper);

        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        return buildLoginUser(user);
    }

    public LoginUserDTO loadUserById(Long userId) {
        SysUser user = sysUserMapper.selectById(userId);
        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + userId);
        }
        return buildLoginUser(user);
    }

    private LoginUserDTO buildLoginUser(SysUser user) {
        LoginUserDTO loginUser = new LoginUserDTO();
        loginUser.setUserId(user.getId());
        loginUser.setUsername(user.getUsername());
        loginUser.setPassword(user.getPassword());
        loginUser.setNickname(user.getNickname());
        loginUser.setDeptId(user.getDeptId());
        loginUser.setEnabled(user.getStatus() == 1);
        loginUser.setAccountNonExpired(true);
        loginUser.setAccountNonLocked(true);
        loginUser.setCredentialsNonExpired(true);

        if (user.getDeptId() != null) {
            SysDept dept = sysDeptMapper.selectById(user.getDeptId());
            if (dept != null) {
                loginUser.setDeptName(dept.getDeptName());
            }
        }

        Set<String> roles = sysUserMapper.selectRoleCodesByUserId(user.getId());
        Set<String> permissions = sysUserMapper.selectPermissionCodesByUserId(user.getId());
        loginUser.setRoles(roles);
        loginUser.setPermissions(permissions);

        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.addAll(roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList()));
        authorities.addAll(permissions.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList()));
        loginUser.setAuthorities(authorities);

        return loginUser;
    }
}
