package com.audit.logger;

import org.springframework.stereotype.Component;

@Component
public class AuditContext {

    private static final ThreadLocal<String> TRACE_ID_HOLDER = new ThreadLocal<>();
    private static final ThreadLocal<String> OPERATOR_ID_HOLDER = new ThreadLocal<>();
    private static final ThreadLocal<String> OPERATOR_NAME_HOLDER = new ThreadLocal<>();
    private static final ThreadLocal<String> OPERATOR_IP_HOLDER = new ThreadLocal<>();

    public void setTraceId(String traceId) {
        TRACE_ID_HOLDER.set(traceId);
    }

    public String getTraceId() {
        return TRACE_ID_HOLDER.get();
    }

    public void setOperatorId(String operatorId) {
        OPERATOR_ID_HOLDER.set(operatorId);
    }

    public String getOperatorId() {
        return OPERATOR_ID_HOLDER.get();
    }

    public void setOperatorName(String operatorName) {
        OPERATOR_NAME_HOLDER.set(operatorName);
    }

    public String getOperatorName() {
        return OPERATOR_NAME_HOLDER.get();
    }

    public void setOperatorIp(String operatorIp) {
        OPERATOR_IP_HOLDER.set(operatorIp);
    }

    public String getOperatorIp() {
        return OPERATOR_IP_HOLDER.get();
    }

    public void clear() {
        TRACE_ID_HOLDER.remove();
        OPERATOR_ID_HOLDER.remove();
        OPERATOR_NAME_HOLDER.remove();
        OPERATOR_IP_HOLDER.remove();
    }
}
