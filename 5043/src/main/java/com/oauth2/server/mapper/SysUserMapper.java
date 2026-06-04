package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.SysUser;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Set;

public interface SysUserMapper extends BaseMapper<SysUser> {

    @Select("SELECT r.role_code FROM sys_role r " +
            "INNER JOIN sys_user_role ur ON r.id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND ur.deleted = 0 AND r.deleted = 0 AND r.status = 1")
    Set<String> selectRoleCodesByUserId(@Param("userId") Long userId);

    @Select("SELECT p.permission_code FROM sys_permission p " +
            "INNER JOIN sys_role_permission rp ON p.id = rp.permission_id " +
            "INNER JOIN sys_user_role ur ON rp.role_id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND ur.deleted = 0 AND rp.deleted = 0 AND p.deleted = 0 AND p.status = 1")
    Set<String> selectPermissionCodesByUserId(@Param("userId") Long userId);
}
