package com.crm.lead.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.entity.ReminderMessage;
import com.crm.lead.mapper.ReminderMessageMapper;
import com.crm.lead.service.ReminderService;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Service
public class ReminderServiceImpl extends ServiceImpl<ReminderMessageMapper, ReminderMessage>
        implements ReminderService {

    @Override
    public void sendReminder(Long recipientId, String recipientName, String reminderType,
                             Long leadId, String title, String content) {
        ReminderMessage message = new ReminderMessage();
        message.setRecipientId(recipientId);
        message.setRecipientName(recipientName);
        message.setReminderType(reminderType);
        message.setLeadId(leadId);
        message.setTitle(title);
        message.setContent(content);
        message.setIsRead(0);
        message.setCreatedTime(new Date());
        save(message);
    }

    @Override
    public List<ReminderMessage> getUnreadMessages(Long recipientId) {
        return list(new LambdaQueryWrapper<ReminderMessage>()
                .eq(ReminderMessage::getRecipientId, recipientId)
                .eq(ReminderMessage::getIsRead, 0)
                .orderByDesc(ReminderMessage::getCreatedTime));
    }

    @Override
    public void markAsRead(Long id) {
        ReminderMessage message = getById(id);
        if (message != null) {
            message.setIsRead(1);
            message.setReadTime(new Date());
            updateById(message);
        }
    }
}
