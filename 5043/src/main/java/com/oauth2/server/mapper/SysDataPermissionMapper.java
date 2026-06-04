package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.SysDataPermission;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface SysDataPermissionMapper extends BaseMapper<SysDataPermission> {

    @Select("SELECT dp.* FROM sys_data_permission dp " +
            "INNER JOIN sys_user_role ur ON dp.role_id = ur.role_id " +
            "WHERE ur.user_id = #{userId} AND ur.deleted = 0 AND dp.deleted = 0 AND dp.status = 1")
    List<SysDataPermission> selectByUserId(@Param("userId") Long userId);

    @Select("SELECT dp.* FROM sys_data_permission dp " +
            "WHERE dp.role_id = #{roleId} AND dp.deleted = 0 AND dp.status = 1")
    List<SysDataPermission> selectByRoleId(@Param("roleId") Long roleId);
}
