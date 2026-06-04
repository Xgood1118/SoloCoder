package com.oauth2.server.controller;

import com.oauth2.server.common.Result;
import com.oauth2.server.dto.TokenResponseDTO;
import com.oauth2.server.service.ThirdPartyLoginService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/auth/third-party")
@RequiredArgsConstructor
public class ThirdPartyLoginController {

    private final ThirdPartyLoginService thirdPartyLoginService;

    @GetMapping("/wechat")
    public void wechatLogin(@RequestParam(required = false) String redirect,
                            @RequestParam(defaultValue = "default_client") String clientId,
                            HttpServletResponse response) throws IOException {
        String appId = System.getenv().getOrDefault("WECHAT_CLIENT_ID", "wx_app_id");
        String redirectUri = "http://localhost:8080/oauth2/auth/third-party/wechat/callback?clientId=" + clientId;
        if (redirect != null) {
            redirectUri += "&redirect=" + java.net.URLEncoder.encode(redirect, "UTF-8");
        }

        String authUrl = "https://open.weixin.qq.com/connect/qrconnect" +
                "?appid=" + appId +
                "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, "UTF-8") +
                "&response_type=code" +
                "&scope=snsapi_login" +
                "&state=" + System.currentTimeMillis();

        response.sendRedirect(authUrl);
    }

    @GetMapping("/wechat/callback")
    public Result<TokenResponseDTO> wechatCallback(@RequestParam String code,
                                                   @RequestParam(defaultValue = "default_client") String clientId,
                                                   @RequestParam(required = false) String redirect) {
        return thirdPartyLoginService.loginByWechat(code, clientId);
    }

    @GetMapping("/dingtalk")
    public void dingtalkLogin(@RequestParam(required = false) String redirect,
                              @RequestParam(defaultValue = "default_client") String clientId,
                              HttpServletResponse response) throws IOException {
        String appId = System.getenv().getOrDefault("DINGTALK_CLIENT_ID", "dingtalk_app_id");
        String redirectUri = "http://localhost:8080/oauth2/auth/third-party/dingtalk/callback?clientId=" + clientId;
        if (redirect != null) {
            redirectUri += "&redirect=" + java.net.URLEncoder.encode(redirect, "UTF-8");
        }

        String authUrl = "https://login.dingtalk.com/oauth2/auth" +
                "?client_id=" + appId +
                "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, "UTF-8") +
                "&response_type=code" +
                "&scope=openid" +
                "&state=" + System.currentTimeMillis() +
                "&prompt=consent";

        response.sendRedirect(authUrl);
    }

    @GetMapping("/dingtalk/callback")
    public Result<TokenResponseDTO> dingtalkCallback(@RequestParam String code,
                                                     @RequestParam(defaultValue = "default_client") String clientId,
                                                     @RequestParam(required = false) String redirect) {
        return thirdPartyLoginService.loginByDingTalk(code, clientId);
    }

    @GetMapping("/wework")
    public void weworkLogin(@RequestParam(required = false) String redirect,
                            @RequestParam(defaultValue = "default_client") String clientId,
                            HttpServletResponse response) throws IOException {
        String appId = System.getenv().getOrDefault("WEWORK_CLIENT_ID", "wework_app_id");
        String agentId = System.getenv().getOrDefault("WEWORK_AGENT_ID", "1000001");
        String redirectUri = "http://localhost:8080/oauth2/auth/third-party/wework/callback?clientId=" + clientId;
        if (redirect != null) {
            redirectUri += "&redirect=" + java.net.URLEncoder.encode(redirect, "UTF-8");
        }

        String authUrl = "https://open.weixin.qq.com/connect/oauth2/authorize" +
                "?appid=" + appId +
                "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, "UTF-8") +
                "&response_type=code" +
                "&scope=snsapi_base" +
                "&state=" + System.currentTimeMillis() +
                "#wechat_redirect";

        response.sendRedirect(authUrl);
    }

    @GetMapping("/wework/callback")
    public Result<TokenResponseDTO> weworkCallback(@RequestParam String code,
                                                   @RequestParam(defaultValue = "default_client") String clientId,
                                                   @RequestParam(required = false) String redirect) {
        return thirdPartyLoginService.loginByWeWork(code, clientId);
    }

    @GetMapping("/providers")
    public Result<Map<String, Object>> getProviders() {
        Map<String, Object> providers = new HashMap<>();

        Map<String, Object> wechat = new HashMap<>();
        wechat.put("name", "微信登录");
        wechat.put("enabled", "true".equals(System.getenv().getOrDefault("WECHAT_ENABLED", "true")));
        providers.put("wechat", wechat);

        Map<String, Object> dingtalk = new HashMap<>();
        dingtalk.put("name", "钉钉登录");
        dingtalk.put("enabled", "true".equals(System.getenv().getOrDefault("DINGTALK_ENABLED", "true")));
        providers.put("dingtalk", dingtalk);

        Map<String, Object> wework = new HashMap<>();
        wework.put("name", "企业微信登录");
        wework.put("enabled", "true".equals(System.getenv().getOrDefault("WEWORK_ENABLED", "true")));
        providers.put("wework", wework);

        return Result.success(providers);
    }
}
