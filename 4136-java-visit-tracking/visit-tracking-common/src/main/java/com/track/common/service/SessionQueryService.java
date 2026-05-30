package com.track.common.service;

import com.track.common.dto.SessionDetailResponse;

public interface SessionQueryService {

    SessionDetailResponse getSessionDetail(String sessionId);
}
