package com.ticket.system.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "ticket.sla")
public class SlaProperties {

    private int urgentResponseHours = 2;
    private int importantResponseHours = 4;
    private int normalResponseHours = 8;
    private int lowResponseHours = 24;
    private int warningThresholdMinutes = 30;

    public int getResponseHoursByPriority(com.ticket.system.entity.Ticket.Priority priority) {
        return switch (priority) {
            case URGENT -> urgentResponseHours;
            case IMPORTANT -> importantResponseHours;
            case NORMAL -> normalResponseHours;
            case LOW -> lowResponseHours;
        };
    }
}
