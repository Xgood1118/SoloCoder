package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.OAuthAuthorizationCode;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

public interface OAuthAuthorizationCodeMapper extends BaseMapper<OAuthAuthorizationCode> {

    @Select("SELECT * FROM oauth_authorization_code WHERE code = #{code} AND deleted = 0")
    Optional<OAuthAuthorizationCode> selectByCode(String code);

    @Delete("DELETE FROM oauth_authorization_code WHERE code = #{code}")
    void deleteByCode(@Param("code") String code);
}
