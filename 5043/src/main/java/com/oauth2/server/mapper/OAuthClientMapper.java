package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.OAuthClient;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

public interface OAuthClientMapper extends BaseMapper<OAuthClient> {

    @Select("SELECT * FROM oauth_client WHERE client_id = #{clientId} AND deleted = 0")
    Optional<OAuthClient> selectByClientId(String clientId);
}
