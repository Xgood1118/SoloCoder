package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.OAuthRefreshToken;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

public interface OAuthRefreshTokenMapper extends BaseMapper<OAuthRefreshToken> {

    @Select("SELECT * FROM oauth_refresh_token WHERE token_id = #{tokenId} AND deleted = 0")
    Optional<OAuthRefreshToken> selectByTokenId(String tokenId);

    @Delete("DELETE FROM oauth_refresh_token WHERE token_id = #{tokenId}")
    void deleteByTokenId(@Param("tokenId") String tokenId);
}
