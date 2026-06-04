package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.SysPermission;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface SysPermissionMapper extends BaseMapper<SysPermission> {

    @Select("SELECT p.* FROM sys_permission p " +
            "INNER JOIN sys_role_permission rp ON p.id = rp.permission_id " +
            "WHERE rp.role_id = #{roleId} AND rp.deleted = 0 AND p.deleted = 0")
    List<SysPermission> selectPermissionsByRoleId(@Param("roleId") Long roleId);

    @Select("SELECT DISTINCT p.* FROM sys_permission p " +
            "INNER JOIN sys_role_permission rp ON p.id = rp.permission_id " +
            "INNER JOIN sys_user_role ur ON rp.role_id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND ur.deleted = 0 AND rp.deleted = 0 AND p.deleted = 0 AND p.status = 1")
    List<SysPermission> selectPermissionsByUserId(@Param("userId") Long userId);
}
