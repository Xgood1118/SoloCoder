package com.mq.simulator.config;

import com.mq.simulator.core.MQType;

public class MQConfig {
    private MQType type;
    private String host;
    private int port;
    private String username;
    private String password;
    private String virtualHost;
    private String bootstrapServers;
    private String groupId;
    private String clientId;
    private boolean autoCommit = true;
    private int autoCommitIntervalMs = 5000;
    private int sessionTimeoutMs = 30000;
    private int requestTimeoutMs = 40000;
    private String acks = "1";
    private int retries = 0;
    private int lingerMs = 0;
    private int batchSize = 16384;
    private int connectionTimeoutMs = 10000;
    private boolean useTls = false;
    private String saslMechanism;
    private String securityProtocol;

    public MQConfig() {
    }

    public static MQConfig rabbitMqDefault() {
        MQConfig config = new MQConfig();
        config.setType(MQType.RABBITMQ);
        config.setHost("localhost");
        config.setPort(5672);
        config.setUsername("guest");
        config.setPassword("guest");
        config.setVirtualHost("/");
        return config;
    }

    public static MQConfig kafkaDefault() {
        MQConfig config = new MQConfig();
        config.setType(MQType.KAFKA);
        config.setBootstrapServers("localhost:9092");
        config.setGroupId("mq-simulator-group");
        config.setClientId("mq-simulator-client");
        return config;
    }

    public MQType getType() {
        return type;
    }

    public void setType(MQType type) {
        this.type = type;
    }

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public int getPort() {
        return port;
    }

    public void setPort(int port) {
        this.port = port;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getVirtualHost() {
        return virtualHost;
    }

    public void setVirtualHost(String virtualHost) {
        this.virtualHost = virtualHost;
    }

    public String getBootstrapServers() {
        return bootstrapServers;
    }

    public void setBootstrapServers(String bootstrapServers) {
        this.bootstrapServers = bootstrapServers;
    }

    public String getGroupId() {
        return groupId;
    }

    public void setGroupId(String groupId) {
        this.groupId = groupId;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public boolean isAutoCommit() {
        return autoCommit;
    }

    public void setAutoCommit(boolean autoCommit) {
        this.autoCommit = autoCommit;
    }

    public int getAutoCommitIntervalMs() {
        return autoCommitIntervalMs;
    }

    public void setAutoCommitIntervalMs(int autoCommitIntervalMs) {
        this.autoCommitIntervalMs = autoCommitIntervalMs;
    }

    public int getSessionTimeoutMs() {
        return sessionTimeoutMs;
    }

    public void setSessionTimeoutMs(int sessionTimeoutMs) {
        this.sessionTimeoutMs = sessionTimeoutMs;
    }

    public int getRequestTimeoutMs() {
        return requestTimeoutMs;
    }

    public void setRequestTimeoutMs(int requestTimeoutMs) {
        this.requestTimeoutMs = requestTimeoutMs;
    }

    public String getAcks() {
        return acks;
    }

    public void setAcks(String acks) {
        this.acks = acks;
    }

    public int getRetries() {
        return retries;
    }

    public void setRetries(int retries) {
        this.retries = retries;
    }

    public int getLingerMs() {
        return lingerMs;
    }

    public void setLingerMs(int lingerMs) {
        this.lingerMs = lingerMs;
    }

    public int getBatchSize() {
        return batchSize;
    }

    public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
    }

    public int getConnectionTimeoutMs() {
        return connectionTimeoutMs;
    }

    public void setConnectionTimeoutMs(int connectionTimeoutMs) {
        this.connectionTimeoutMs = connectionTimeoutMs;
    }

    public boolean isUseTls() {
        return useTls;
    }

    public void setUseTls(boolean useTls) {
        this.useTls = useTls;
    }

    public String getSaslMechanism() {
        return saslMechanism;
    }

    public void setSaslMechanism(String saslMechanism) {
        this.saslMechanism = saslMechanism;
    }

    public String getSecurityProtocol() {
        return securityProtocol;
    }

    public void setSecurityProtocol(String securityProtocol) {
        this.securityProtocol = securityProtocol;
    }

    @Override
    public String toString() {
        return "MQConfig{" +
                "type=" + type +
                ", host='" + host + '\'' +
                ", port=" + port +
                ", bootstrapServers='" + bootstrapServers + '\'' +
                ", groupId='" + groupId + '\'' +
                '}';
    }
}
