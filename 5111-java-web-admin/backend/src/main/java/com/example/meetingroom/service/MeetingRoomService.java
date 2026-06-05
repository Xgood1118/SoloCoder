package com.example.meetingroom.service;

import com.example.meetingroom.dto.AvailableRoomQueryDTO;
import com.example.meetingroom.dto.MeetingRoomDTO;
import com.example.meetingroom.dto.MeetingRoomQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.entity.MeetingRoom;

import java.time.LocalDateTime;
import java.util.List;

public interface MeetingRoomService {

    MeetingRoomDTO create(MeetingRoomDTO dto);

    MeetingRoomDTO update(Long id, MeetingRoomDTO dto);

    void delete(Long id);

    MeetingRoomDTO getById(Long id);

    PageResult<MeetingRoomDTO> list(MeetingRoomQueryDTO query);

    List<MeetingRoomDTO> findAvailableRooms(LocalDateTime startTime, LocalDateTime endTime);

    List<MeetingRoomDTO> findAvailableRoomsWithFilter(AvailableRoomQueryDTO query);

    List<MeetingRoomDTO> getAllActiveRooms();

    MeetingRoom getEntityById(Long id);

    void validateRoomAvailable(MeetingRoom room, LocalDateTime startTime, LocalDateTime endTime);
}
