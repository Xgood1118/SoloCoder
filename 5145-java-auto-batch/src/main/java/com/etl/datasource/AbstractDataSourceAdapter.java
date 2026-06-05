package com.etl.datasource;

import com.etl.model.DataSourceConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public abstract class AbstractDataSourceAdapter implements DataSourceAdapter {

    protected DataSourceConfig config;
    protected Logger logger = LoggerFactory.getLogger(getClass());
    protected boolean connected = false;
    protected int retryCount = 3;

    @Override
    public void connect(DataSourceConfig config) {
        this.config = config;
        this.retryCount = config.getRetryCount();

        for (int i = 0; i < retryCount; i++) {
            try {
                doConnect(config);
                connected = true;
                logger.info("Connected to datasource [{}] successfully", config.getName());
                return;
            } catch (Exception e) {
                handleException(e);
                logger.warn("Connection attempt {}/{} failed for datasource [{}]", i + 1, retryCount, config.getName());
            }
        }

        DataSourceConfig standbyConfig = config.getStandbyConfig();
        if (standbyConfig != null) {
            logger.warn("All {} attempts failed for datasource [{}], switching to standby datasource [{}]",
                    retryCount, config.getName(), standbyConfig.getName());
            this.config = standbyConfig;
            this.retryCount = standbyConfig.getRetryCount();
            for (int i = 0; i < this.retryCount; i++) {
                try {
                    doConnect(standbyConfig);
                    connected = true;
                    logger.info("Connected to standby datasource [{}] successfully", standbyConfig.getName());
                    return;
                } catch (Exception e) {
                    handleException(e);
                    logger.warn("Standby connection attempt {}/{} failed for datasource [{}]",
                            i + 1, this.retryCount, standbyConfig.getName());
                }
            }
        }

        throw new RuntimeException("Failed to connect to datasource [" + config.getName() + "] after " + retryCount + " attempts");
    }

    protected abstract void doConnect(DataSourceConfig config) throws Exception;

    protected abstract void doDisconnect();

    @Override
    public void disconnect() {
        if (connected) {
            try {
                doDisconnect();
                connected = false;
                logger.info("Disconnected from datasource [{}]", config.getName());
            } catch (Exception e) {
                handleException(e);
            }
        }
    }

    @Override
    public boolean testConnection() {
        try {
            connect(config);
            disconnect();
            return true;
        } catch (Exception e) {
            handleException(e);
            return false;
        }
    }

    protected void handleException(Exception e) {
        logger.error("Datasource adapter error: {}", e.getMessage(), e);
    }
}
