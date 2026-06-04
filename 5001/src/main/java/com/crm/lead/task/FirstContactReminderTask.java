package com.crm.lead.task;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.entity.Salesperson;
import com.crm.lead.enums.LeadStatusEnum;
import com.crm.lead.mapper.SalesLeadMapper;
import com.crm.lead.mapper.SalespersonMapper;
import com.crm.lead.service.ReminderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.List;

@Component
public class FirstContactReminderTask {

    @Autowired
    private SalesLeadMapper leadMapper;

    @Autowired
    private SalespersonMapper salespersonMapper;

    @Autowired
    private ReminderService reminderService;

    @Scheduled(cron = "0 0 9 * * ?")
    public void checkFirstContactOverdue() {
        LambdaQueryWrapper<SalesLead> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SalesLead::getLeadStatus, LeadStatusEnum.PENDING_CONFIRM.name())
                .isNull(SalesLead::getFirstContactTime)
                .isNotNull(SalesLead::getFirstContactDeadline)
                .eq(SalesLead::getIsFirstContactOverdue, 0)
                .eq(SalesLead::getIsDeleted, 0);

        List<SalesLead> leads = leadMapper.selectList(wrapper);
        Date now = new Date();

        for (SalesLead lead : leads) {
            if (lead.getFirstContactDeadline().before(now)) {
                handleOverdueLead(lead);
            }
        }
    }

    private void handleOverdueLead(SalesLead lead) {
        leadMapper.update(null,
                new LambdaUpdateWrapper<SalesLead>()
                        .eq(SalesLead::getId, lead.getId())
                        .set(SalesLead::getIsFirstContactOverdue, 1)
                        .set(SalesLead::getUpdatedTime, new Date())
        );

        if (lead.getSalespersonId() != null) {
            Salesperson salesperson = salespersonMapper.selectById(lead.getSalespersonId());
            if (salesperson != null) {
                reminderService.sendReminder(
                        salesperson.getId(),
                        salesperson.getName(),
                        "FIRST_CONTACT_OVERDUE",
                        lead.getId(),
                        "首次联系超时提醒",
                        "线索" + lead.getLeadNo() + "已超过首次联系截止时间，请尽快联系客户"
                );
            }
        }
    }
}
