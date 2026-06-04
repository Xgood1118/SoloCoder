package com.crm.lead.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.entity.SystemConfig;
import com.crm.lead.mapper.SystemConfigMapper;
import com.crm.lead.service.SystemConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;

@Service
public class SystemConfigServiceImpl extends ServiceImpl<SystemConfigMapper, SystemConfig> implements SystemConfigService {

    @Autowired
    private SystemConfigMapper systemConfigMapper;

    @Override
    public String getConfigValue(String configKey) {
        SystemConfig config = systemConfigMapper.selectOne(
                new LambdaQueryWrapper<SystemConfig>()
                        .eq(SystemConfig::getConfigKey, configKey)
        );
        return config != null ? config.getConfigValue() : null;
    }

    @Override
    public String getConfigValue(String configKey, String defaultValue) {
        String value = getConfigValue(configKey);
        return value != null ? value : defaultValue;
    }

    @Override
    public Integer getConfigIntValue(String configKey, Integer defaultValue) {
        String value = getConfigValue(configKey);
        if (value == null) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    @Override
    public void updateConfig(String configKey, String configValue) {
        systemConfigMapper.update(null,
                new LambdaUpdateWrapper<SystemConfig>()
                        .eq(SystemConfig::getConfigKey, configKey)
                        .set(SystemConfig::getConfigValue, configValue)
                        .set(SystemConfig::getUpdatedTime, new Date())
        );
    }
}
