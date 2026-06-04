package com.crm.lead.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.entity.ReminderMessage;

import java.util.List;

public interface ReminderService extends IService<ReminderMessage> {

    void sendReminder(Long recipientId, String recipientName, String reminderType,
                      Long leadId, String title, String content);

    List<ReminderMessage> getUnreadMessages(Long recipientId);

    void markAsRead(Long id);
}
