package com.track.common.repository;

import com.track.common.entity.HeartbeatEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeartbeatEventRepository extends JpaRepository<HeartbeatEvent, Long> {
}
