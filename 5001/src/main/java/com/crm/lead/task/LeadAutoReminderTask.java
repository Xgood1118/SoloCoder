package com.crm.lead.task;

import com.crm.lead.service.LeadAllocationService;
import com.crm.lead.service.PoolService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class LeadAutoReminderTask {

    @Autowired
    private PoolService poolService;

    @Autowired
    private LeadAllocationService leadAllocationService;

    @Scheduled(cron = "0 0 10 * * ?")
    public void executeDailyTasks() {
        poolService.autoReturnToPool();
        leadAllocationService.batchAllocateLeads();
    }
}
