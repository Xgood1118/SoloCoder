package com.bpm.engine.bpmn.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class UserTaskConfig {

    private String assigneeExpression;
    private List<String> candidateUsers = new ArrayList<>();
    private List<String> candidateGroups = new ArrayList<>();
    private String formKey;
    private String dueDateExpression;
    private String priorityExpression;
}
