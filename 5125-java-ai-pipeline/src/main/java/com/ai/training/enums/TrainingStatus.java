package com.ai.training.enums;

public enum TrainingStatus {
    PENDING_TRAINING("待训练"),
    TRAINING("训练中"),
    VALIDATING("验证中"),
    PENDING_DEPLOYMENT("待部署"),
    DEPLOYED("已上线"),
    OFFLINE("下线");

    private final String description;

    TrainingStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
