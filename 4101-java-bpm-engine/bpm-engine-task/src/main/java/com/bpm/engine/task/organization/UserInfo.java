package com.bpm.engine.task.organization;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserInfo {

    private String userId;
    private String userName;
    private String departmentId;
    private String departmentName;
    private String managerId;
    private boolean isActive;
}
