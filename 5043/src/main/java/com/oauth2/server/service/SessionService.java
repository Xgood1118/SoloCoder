package com.oauth2.server.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    private static final String SESSION_PREFIX = "spring:session:sessions:";
    private static final String USER_SESSION_KEY = "LOGIN_USER";
    private static final String PRINCIPAL_NAME_INDEX_NAME = FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME;

    private final RedisTemplate<String, Object> redisTemplate;
    private final FindByIndexNameSessionRepository<? extends Session> sessionRepository;

    public void setLoginUser(HttpServletRequest request, Object loginUser) {
        HttpSession session = request.getSession();
        session.setAttribute(USER_SESSION_KEY, loginUser);
        session.setMaxInactiveInterval(1800);
    }

    public Object getLoginUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        return session.getAttribute(USER_SESSION_KEY);
    }

    public void invalidateSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            String sessionId = session.getId();
            session.invalidate();
            redisTemplate.delete(SESSION_PREFIX + sessionId);
            redisTemplate.delete(SESSION_PREFIX + "expires:" + sessionId);
        }
    }

    public void invalidateUserSessions(String username) {
        Map<String, ? extends Session> sessions = sessionRepository.findByPrincipalName(username);
        for (Map.Entry<String, ? extends Session> entry : sessions.entrySet()) {
            sessionRepository.deleteById(entry.getKey());
        }
    }

    public void invalidateUserSessions(Long userId, String username) {
        invalidateUserSessions(username);
        String pattern = "spring:session:index:" + PRINCIPAL_NAME_INDEX_NAME + ":" + username;
        Set<String> keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    public void extendSession(HttpServletRequest request, int seconds) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.setMaxInactiveInterval(seconds);
        }
    }

    public boolean isSessionValid(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return false;
        }
        Object user = session.getAttribute(USER_SESSION_KEY);
        return user != null;
    }

    public long getSessionRemainingTime(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return 0;
        }
        String sessionId = session.getId();
        Long ttl = redisTemplate.getExpire(SESSION_PREFIX + sessionId, TimeUnit.SECONDS);
        return ttl != null ? ttl : 0;
    }

    public void setSessionAttribute(HttpServletRequest request, String key, Object value) {
        HttpSession session = request.getSession();
        session.setAttribute(key, value);
    }

    public Object getSessionAttribute(HttpServletRequest request, String key) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        return session.getAttribute(key);
    }

    public void removeSessionAttribute(HttpServletRequest request, String key) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.removeAttribute(key);
        }
    }

    public void clearAllSessionAttributes(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            var attributeNames = session.getAttributeNames();
            while (attributeNames.hasMoreElements()) {
                String name = attributeNames.nextElement();
                session.removeAttribute(name);
            }
        }
    }

    public int getActiveSessionsCount(String username) {
        Map<String, ? extends Session> sessions = sessionRepository.findByPrincipalName(username);
        return sessions.size();
    }

    public void forceLogout(String username) {
        invalidateUserSessions(username);
    }
}
