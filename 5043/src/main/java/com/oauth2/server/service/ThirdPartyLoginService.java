package com.oauth2.server.service;

import cn.hutool.core.util.StrUtil;
import cn.hutool.http.HttpUtil;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.oauth2.server.common.Result;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.dto.TokenResponseDTO;
import com.oauth2.server.entity.SysUser;
import com.oauth2.server.entity.ThirdPartyUser;
import com.oauth2.server.mapper.SysUserMapper;
import com.oauth2.server.mapper.ThirdPartyUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ThirdPartyLoginService {

    private static final String PROVIDER_WECHAT = "wechat";
    private static final String PROVIDER_DINGTALK = "dingtalk";
    private static final String PROVIDER_WEWORK = "wework";

    private final ThirdPartyUserMapper thirdPartyUserMapper;
    private final SysUserMapper sysUserMapper;
    private final UserDetailsServiceImpl userDetailsService;
    private final TokenService tokenService;
    private final PasswordEncoder passwordEncoder;

    public Result<TokenResponseDTO> loginByWechat(String code, String clientId) {
        try {
            String tokenUrl = "https://api.weixin.qq.com/sns/oauth2/access_token";
            Map<String, Object> params = new HashMap<>();
            params.put("appid", System.getenv().getOrDefault("WECHAT_CLIENT_ID", "wx_app_id"));
            params.put("secret", System.getenv().getOrDefault("WECHAT_CLIENT_SECRET", "wx_app_secret"));
            params.put("code", code);
            params.put("grant_type", "authorization_code");

            String response = HttpUtil.get(tokenUrl, params, 5000);
            JSONObject tokenJson = JSON.parseObject(response);

            if (tokenJson.containsKey("errcode")) {
                return Result.error("WeChat token error: " + tokenJson.getString("errmsg"));
            }

            String accessToken = tokenJson.getString("access_token");
            String openId = tokenJson.getString("openid");
            String unionId = tokenJson.getString("unionid");

            String userInfoUrl = "https://api.weixin.qq.com/sns/userinfo";
            Map<String, Object> userParams = new HashMap<>();
            userParams.put("access_token", accessToken);
            userParams.put("openid", openId);
            userParams.put("lang", "zh_CN");

            String userResponse = HttpUtil.get(userInfoUrl, userParams, 5000);
            JSONObject userJson = JSON.parseObject(userResponse);

            if (userJson.containsKey("errcode")) {
                return Result.error("WeChat user info error: " + userJson.getString("errmsg"));
            }

            String nickName = userJson.getString("nickname");
            String avatar = userJson.getString("headimgurl");

            return handleThirdPartyLogin(PROVIDER_WECHAT, openId, unionId, accessToken,
                    null, null, nickName, avatar, clientId);
        } catch (Exception e) {
            log.error("WeChat login error: {}", e.getMessage(), e);
            return Result.error("WeChat login failed");
        }
    }

    public Result<TokenResponseDTO> loginByDingTalk(String code, String clientId) {
        try {
            String tokenUrl = "https://api.dingtalk.com/v1.0/oauth2/userAccessToken";
            JSONObject requestBody = new JSONObject();
            requestBody.put("clientId", System.getenv().getOrDefault("DINGTALK_CLIENT_ID", "dingtalk_app_id"));
            requestBody.put("clientSecret", System.getenv().getOrDefault("DINGTALK_CLIENT_SECRET", "dingtalk_app_secret"));
            requestBody.put("code", code);
            requestBody.put("grantType", "authorization_code");

            String response = HttpUtil.post(tokenUrl, requestBody.toJSONString(), 5000);
            JSONObject tokenJson = JSON.parseObject(response);

            if (tokenJson.containsKey("code")) {
                return Result.error("DingTalk token error: " + tokenJson.getString("message"));
            }

            String accessToken = tokenJson.getString("accessToken");
            String openId = tokenJson.getString("openId");
            String unionId = tokenJson.getString("unionId");

            String userInfoUrl = "https://api.dingtalk.com/v1.0/contact/users/me";
            Map<String, String> headers = new HashMap<>();
            headers.put("x-acs-dingtalk-access-token", accessToken);

            String userResponse = HttpUtil.createGet(userInfoUrl).addHeaders(headers).timeout(5000).execute().body();
            JSONObject userJson = JSON.parseObject(userResponse);

            if (userJson.containsKey("code")) {
                return Result.error("DingTalk user info error: " + userJson.getString("message"));
            }

            String nickName = userJson.getString("nick");
            String avatar = userJson.getString("avatarUrl");

            return handleThirdPartyLogin(PROVIDER_DINGTALK, openId, unionId, accessToken,
                    null, null, nickName, avatar, clientId);
        } catch (Exception e) {
            log.error("DingTalk login error: {}", e.getMessage(), e);
            return Result.error("DingTalk login failed");
        }
    }

    public Result<TokenResponseDTO> loginByWeWork(String code, String clientId) {
        try {
            String tokenUrl = "https://qyapi.weixin.qq.com/cgi-bin/gettoken";
            Map<String, Object> params = new HashMap<>();
            params.put("corpid", System.getenv().getOrDefault("WEWORK_CORP_ID", "wework_corp_id"));
            params.put("corpsecret", System.getenv().getOrDefault("WEWORK_CORP_SECRET", "wework_corp_secret"));

            String response = HttpUtil.get(tokenUrl, params, 5000);
            JSONObject tokenJson = JSON.parseObject(response);

            if (tokenJson.getInteger("errcode") != 0) {
                return Result.error("WeWork token error: " + tokenJson.getString("errmsg"));
            }

            String accessToken = tokenJson.getString("access_token");

            String userInfoUrl = "https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo";
            Map<String, Object> userParams = new HashMap<>();
            userParams.put("access_token", accessToken);
            userParams.put("code", code);

            String userResponse = HttpUtil.get(userInfoUrl, userParams, 5000);
            JSONObject userJson = JSON.parseObject(userResponse);

            if (userJson.getInteger("errcode") != 0) {
                return Result.error("WeWork user info error: " + userJson.getString("errmsg"));
            }

            String userId = userJson.getString("UserId");
            String openId = userJson.getString("OpenId");

            String detailUrl = "https://qyapi.weixin.qq.com/cgi-bin/user/get";
            Map<String, Object> detailParams = new HashMap<>();
            detailParams.put("access_token", accessToken);
            detailParams.put("userid", userId);

            String detailResponse = HttpUtil.get(detailUrl, detailParams, 5000);
            JSONObject detailJson = JSON.parseObject(detailResponse);

            String name = detailJson.getString("name");
            String avatar = detailJson.getString("avatar");
            String email = detailJson.getString("email");
            String mobile = detailJson.getString("mobile");

            return handleThirdPartyLogin(PROVIDER_WEWORK, openId != null ? openId : userId,
                    null, accessToken, email, mobile, name, avatar, clientId);
        } catch (Exception e) {
            log.error("WeWork login error: {}", e.getMessage(), e);
            return Result.error("WeWork login failed");
        }
    }

    private Result<TokenResponseDTO> handleThirdPartyLogin(String provider, String openId, String unionId,
                                                           String accessToken, String email, String phone,
                                                           String nickName, String avatar, String clientId) {
        Optional<ThirdPartyUser> tpUserOpt = thirdPartyUserMapper.selectByProviderAndOpenId(provider, openId);

        Long userId;
        if (tpUserOpt.isPresent()) {
            ThirdPartyUser tpUser = tpUserOpt.get();
            userId = tpUser.getUserId();
            tpUser.setAccessToken(accessToken);
            tpUser.setNickName(nickName);
            tpUser.setAvatarUrl(avatar);
            thirdPartyUserMapper.updateById(tpUser);
        } else {
            SysUser newUser = createNewUser(nickName, email, phone, avatar);
            userId = newUser.getId();

            ThirdPartyUser newTpUser = new ThirdPartyUser();
            newTpUser.setUserId(userId);
            newTpUser.setProvider(provider);
            newTpUser.setOpenId(openId);
            newTpUser.setUnionId(unionId);
            newTpUser.setAccessToken(accessToken);
            newTpUser.setNickName(nickName);
            newTpUser.setAvatarUrl(avatar);
            newTpUser.setStatus(1);
            thirdPartyUserMapper.insert(newTpUser);
        }

        LoginUserDTO loginUser = userDetailsService.loadUserById(userId);
        TokenResponseDTO response = tokenService.createTokenResponse(loginUser, clientId);

        return Result.success(response);
    }

    private SysUser createNewUser(String nickName, String email, String phone, String avatar) {
        String username = "tp_" + System.currentTimeMillis();
        SysUser user = new SysUser();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode("default_password_change_me"));
        user.setNickname(StrUtil.isNotBlank(nickName) ? nickName : "第三方用户");
        user.setEmail(email);
        user.setPhone(phone);
        user.setAvatar(avatar);
        user.setStatus(1);
        sysUserMapper.insert(user);
        return user;
    }

    public Optional<ThirdPartyUser> getThirdPartyUser(String provider, String openId) {
        return thirdPartyUserMapper.selectByProviderAndOpenId(provider, openId);
    }

    public Result<Void> unbindThirdParty(String provider, Long userId) {
        Optional<ThirdPartyUser> tpUserOpt = thirdPartyUserMapper.selectByProviderAndOpenId(provider, null);
        tpUserOpt.ifPresent(tpUser -> {
            if (tpUser.getUserId().equals(userId)) {
                thirdPartyUserMapper.deleteById(tpUser.getId());
            }
        });
        return Result.success();
    }
}
