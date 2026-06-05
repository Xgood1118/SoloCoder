package com.example.meetingroom;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MeetingRoomAdminApplication {

    public static void main(String[] args) {
        SpringApplication.run(MeetingRoomAdminApplication.class, args);
    }
}
