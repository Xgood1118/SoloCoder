package com.wms.service;

import com.wms.entity.OperationLog;
import com.wms.repository.OperationLogRepository;
import com.wms.security.SecurityUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class OperationLogService {

    @Autowired
    private OperationLogRepository operationLogRepository;

    @Autowired
    private SecurityUtil securityUtil;

    public void logOperation(String operation, String module, String method, String params, String ipAddress, boolean success, String errorMsg) {
        OperationLog log = new OperationLog();
        log.setUserId(securityUtil.getCurrentUserId());
        log.setUsername(securityUtil.getCurrentUsername());
        log.setOperation(operation);
        log.setModule(module);
        log.setMethod(method);
        log.setParams(params);
        log.setIpAddress(ipAddress);
        log.setStatus(success ? "SUCCESS" : "FAILED");
        log.setErrorMsg(errorMsg);
        operationLogRepository.save(log);
    }

    public void logSuccess(String operation, String module, String params, String ipAddress) {
        logOperation(operation, module, null, params, ipAddress, true, null);
    }

    public void logFailure(String operation, String module, String params, String ipAddress, String errorMsg) {
        logOperation(operation, module, null, params, ipAddress, false, errorMsg);
    }
}
