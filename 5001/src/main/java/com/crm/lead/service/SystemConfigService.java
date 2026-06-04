package com.crm.lead.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.entity.SystemConfig;

public interface SystemConfigService extends IService<SystemConfig> {

    String getConfigValue(String configKey);

    String getConfigValue(String configKey, String defaultValue);

    Integer getConfigIntValue(String configKey, Integer defaultValue);

    void updateConfig(String configKey, String configValue);
}
