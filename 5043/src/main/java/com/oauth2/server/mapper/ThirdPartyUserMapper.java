package com.oauth2.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.oauth2.server.entity.ThirdPartyUser;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

public interface ThirdPartyUserMapper extends BaseMapper<ThirdPartyUser> {

    @Select("SELECT * FROM third_party_user WHERE provider = #{provider} AND open_id = #{openId} AND deleted = 0")
    Optional<ThirdPartyUser> selectByProviderAndOpenId(@Param("provider") String provider, @Param("openId") String openId);

    @Select("SELECT * FROM third_party_user WHERE provider = #{provider} AND union_id = #{unionId} AND deleted = 0")
    Optional<ThirdPartyUser> selectByProviderAndUnionId(@Param("provider") String provider, @Param("unionId") String unionId);
}
