package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
@TableName("reminder_message")
public class ReminderMessage {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long recipientId;

    private String recipientName;

    private String reminderType;

    private Long leadId;

    private String title;

    private String content;

    private Integer isRead;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date readTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;
}
