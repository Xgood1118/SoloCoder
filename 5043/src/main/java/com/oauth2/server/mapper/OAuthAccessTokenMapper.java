package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.OAuthAccessToken;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Optional;

public interface OAuthAccessTokenMapper extends BaseMapper<OAuthAccessToken> {

    @Select("SELECT * FROM oauth_access_token WHERE token_id = #{tokenId} AND deleted = 0")
    Optional<OAuthAccessToken> selectByTokenId(String tokenId);

    @Select("SELECT * FROM oauth_access_token WHERE authentication_id = #{authenticationId} AND deleted = 0")
    Optional<OAuthAccessToken> selectByAuthenticationId(String authenticationId);

    @Select("SELECT * FROM oauth_access_token WHERE refresh_token = #{refreshToken} AND deleted = 0")
    List<OAuthAccessToken> selectByRefreshToken(String refreshToken);

    @Select("SELECT * FROM oauth_access_token WHERE user_name = #{userName} AND deleted = 0")
    List<OAuthAccessToken> selectByUserName(String userName);

    @Select("SELECT * FROM oauth_access_token WHERE client_id = #{clientId} AND deleted = 0")
    List<OAuthAccessToken> selectByClientId(String clientId);

    @Delete("DELETE FROM oauth_access_token WHERE token_id = #{tokenId}")
    void deleteByTokenId(@Param("tokenId") String tokenId);

    @Delete("DELETE FROM oauth_access_token WHERE refresh_token = #{refreshToken}")
    void deleteByRefreshToken(@Param("refreshToken") String refreshToken);
}
