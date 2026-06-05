package com.ai.training.enums;

public enum ModelType {
    CV("计算机视觉"),
    NLP("自然语言处理"),
    RECOMMENDATION("推荐系统"),
    OTHER("其他");

    private final String description;

    ModelType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
