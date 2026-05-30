package com.track.common.service;

import com.track.common.entity.ClickEvent;
import com.track.common.entity.HeartbeatEvent;
import com.track.common.entity.Session;
import com.track.common.entity.VisitEvent;

public interface DataWriterService {

    void writeVisit(VisitEvent event);

    void writeHeartbeat(HeartbeatEvent event);

    void writeClick(ClickEvent event);

    void saveSession(Session session);

    void updateSession(Session session);
}
