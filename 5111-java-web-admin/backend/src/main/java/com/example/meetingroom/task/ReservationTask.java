package com.example.meetingroom.task;

import com.example.meetingroom.entity.Equipment;
import com.example.meetingroom.entity.Reservation;
import com.example.meetingroom.enums.LockType;
import com.example.meetingroom.enums.ReservationStatus;
import com.example.meetingroom.repository.EquipmentLockLogRepository;
import com.example.meetingroom.repository.EquipmentRepository;
import com.example.meetingroom.repository.ReservationRepository;
import com.example.meetingroom.service.EquipmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReservationTask {

    private final ReservationRepository reservationRepository;
    private final EquipmentRepository equipmentRepository;
    private final EquipmentService equipmentService;

    @Scheduled(cron = "0 0/5 * * * ?")
    @Transactional
    public void autoCompleteExpiredReservations() {
        log.info("开始执行预定自动完成任务");
        LocalDateTime now = LocalDateTime.now();
        List<Reservation> expiredReservations = reservationRepository.findReservationsToComplete(now);
        for (Reservation reservation : expiredReservations) {
            try {
                reservation.setStatus(ReservationStatus.COMPLETED.getCode());
                reservationRepository.save(reservation);
                List<Equipment> equipmentList = equipmentRepository.findLockedEquipmentByRoomId(reservation.getRoomId());
                List<Long> equipmentIds = equipmentList.stream()
                        .map(Equipment::getId)
                        .collect(Collectors.toList());
                if (!equipmentIds.isEmpty()) {
                    equipmentService.unlockEquipmentList(equipmentIds, reservation.getId(),
                            reservation.getRoomId(), reservation.getStartTime(),
                            reservation.getEndTime(), "system", "127.0.0.1");
                }
                log.info("预定[{}]已自动完成，关联设备已解锁", reservation.getId());
            } catch (Exception e) {
                log.error("自动完成预定[{}]失败", reservation.getId(), e);
            }
        }
        log.info("预定自动完成任务执行结束，处理了{}条预定", expiredReservations.size());
    }
}
