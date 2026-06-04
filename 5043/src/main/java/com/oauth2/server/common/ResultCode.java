package com.oauth2.server.common;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未授权访问"),
    FORBIDDEN(403, "权限不足"),
    NOT_FOUND(404, "资源不存在"),
    INTERNAL_ERROR(500, "服务器内部错误"),

    INVALID_CLIENT(1001, "无效的客户端"),
    INVALID_GRANT(1002, "无效的授权类型"),
    INVALID_SCOPE(1003, "无效的权限范围"),
    INVALID_TOKEN(1004, "无效的Token"),
    EXPIRED_TOKEN(1005, "Token已过期"),
    INVALID_USERNAME_PASSWORD(1006, "用户名或密码错误"),
    INVALID_AUTHORIZATION_CODE(1007, "无效的授权码"),
    UNSUPPORTED_GRANT_TYPE(1008, "不支持的授权类型"),

    RATE_LIMIT_EXCEEDED(2001, "接口调用次数超限"),
    QUOTA_EXCEEDED(2002, "应用配额超限"),

    DATA_PERMISSION_DENIED(3001, "数据权限不足"),
    ROLE_NOT_FOUND(3002, "角色不存在"),
    PERMISSION_NOT_FOUND(3003, "权限不存在");

    private final Integer code;
    private final String message;
}
