package com.oauth2.server.exception;

import lombok.Getter;

@Getter
public class OAuth2Exception extends RuntimeException {

    private final Integer code;

    public OAuth2Exception(String message) {
        super(message);
        this.code = 400;
    }

    public OAuth2Exception(Integer code, String message) {
        super(message);
        this.code = code;
    }
}
