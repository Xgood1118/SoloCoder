package com.mq.simulator.cli;

import com.beust.jcommander.JCommander;
import com.beust.jcommander.Parameter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mq.simulator.config.MQConfig;
import com.mq.simulator.core.DelayLevel;
import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.core.MQType;
import com.mq.simulator.delay.DelayMessageManager;
import com.mq.simulator.dlq.DeadLetterQueueManager;
import com.mq.simulator.filter.MessageFilter;
import com.mq.simulator.model.ConsumedMessage;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.MessageTemplate;
import com.mq.simulator.model.SendResult;
import com.mq.simulator.record.TrafficRecorder;
import com.mq.simulator.scheduler.MessageScheduler;
import com.mq.simulator.schema.SchemaManager;
import com.mq.simulator.sender.MessageSender;
import com.mq.simulator.sender.MessageSenderFactory;
import com.mq.simulator.template.TemplateManager;
import com.mq.simulator.consumer.MessageConsumer;
import com.mq.simulator.consumer.MessageConsumerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class MqSimulatorCli {
    private static final Logger logger = LoggerFactory.getLogger(MqSimulatorCli.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static MQConfig currentConfig;
    private static MessageSender currentSender;
    private static MessageConsumer currentConsumer;
    private static TemplateManager templateManager;
    private static SchemaManager schemaManager;
    private static MessageScheduler scheduler;
    private static DelayMessageManager delayManager;
    private static DeadLetterQueueManager dlqManager;
    private static TrafficRecorder trafficRecorder;
    private static MessageFilter currentFilter;

    @Parameter(names = {"--mq-type", "-t"}, description = "MQ类型: RABBITMQ, KAFKA, ROCKETMQ")
    private String mqType = "KAFKA";

    @Parameter(names = {"--host", "-H"}, description = "MQ服务器地址")
    private String host = "localhost";

    @Parameter(names = {"--port", "-p"}, description = "MQ端口")
    private int port = 9092;

    @Parameter(names = {"--bootstrap-servers"}, description = "Kafka bootstrap servers")
    private String bootstrapServers = "localhost:9092";

    @Parameter(names = {"--username", "-u"}, description = "用户名")
    private String username = "guest";

    @Parameter(names = {"--password", "-P"}, description = "密码")
    private String password = "guest";

    @Parameter(names = {"--topic"}, description = "主题名称")
    private String topic;

    @Parameter(names = {"--message", "-m"}, description = "消息内容")
    private String message;

    @Parameter(names = {"--format", "-f"}, description = "消息格式: JSON, XML, PLAINTEXT, AVRO, PROTOBUF")
    private String format = "JSON";

    @Parameter(names = {"--count", "-c"}, description = "发送数量")
    private int count = 1;

    @Parameter(names = {"--interval"}, description = "发送间隔(毫秒)")
    private long interval = 1000;

    @Parameter(names = {"--rate"}, description = "每秒发送速率")
    private int rate = 0;

    @Parameter(names = {"--template"}, description = "使用的模板名称")
    private String templateName;

    @Parameter(names = {"--delay-level"}, description = "延迟等级: 1-12")
    private Integer delayLevel;

    @Parameter(names = {"--delay-ms"}, description = "自定义延迟(毫秒)")
    private long delayMs = 0;

    @Parameter(names = {"--operation", "-o"}, description = "操作类型: send, consume, template, schedule, record, replay, dlq, delay, filter, server, gui")
    private String operation = "send";

    @Parameter(names = {"--help", "-h"}, help = true, description = "显示帮助信息")
    private boolean help;

    @Parameter(names = {"--interactive", "-i"}, description = "交互模式", arity = 0)
    private boolean interactive;

    @Parameter(names = {"--server-port"}, description = "HTTP 服务器端口")
    private int serverPort = 8080;

    @Parameter(names = {"--template-export"}, description = "导出指定名称的模板")
    private String templateExport;

    @Parameter(names = {"--template-import"}, description = "从文件导入模板")
    private String templateImport;

    @Parameter(names = {"--template-export-file"}, description = "模板导出文件路径")
    private String templateExportFile;

    public static void main(String[] args) throws Exception {
        MqSimulatorCli cli = new MqSimulatorCli();
        JCommander commander = JCommander.newBuilder()
                .addObject(cli)
                .build();

        try {
            commander.parse(args);
        } catch (com.beust.jcommander.ParameterException e) {
            System.err.println("参数解析错误: " + e.getMessage());
            commander.usage();
            System.exit(1);
        }

        if (cli.help) {
            commander.usage();
            return;
        }

        System.out.println("╔══════════════════════════════════════════════════════════════╗");
        System.out.println("║           MQ 消息模拟器 v1.0                                ║");
        System.out.println("╚══════════════════════════════════════════════════════════════╝");

        cli.initManagers();

        if ("gui".equalsIgnoreCase(cli.operation)) {
            System.out.println("[OK] 正在启动 GUI 界面...");
            com.mq.simulator.gui.MqSimulatorGui.start();
            return;
        }

        if ("server".equalsIgnoreCase(cli.operation)) {
            cli.initConfig();
            System.out.println("[OK] 正在启动 HTTP 服务器...");
            com.mq.simulator.http.MqHttpServer server =
                    new com.mq.simulator.http.MqHttpServer(cli.serverPort, currentConfig);
            server.start();

            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                System.out.println("\n正在停止 HTTP 服务器...");
                server.stop();
            }));

            server.waitForShutdown();
            return;
        }

        cli.initConfig();

        if (cli.templateImport != null && !cli.templateImport.isEmpty()) {
            cli.handleTemplateImport();
            cli.closeResources();
            return;
        }

        if (cli.templateExport != null && !cli.templateExport.isEmpty()) {
            cli.handleTemplateExport();
            cli.closeResources();
            return;
        }

        if (cli.interactive) {
            cli.runInteractiveMode();
        } else {
            cli.executeOperation();
        }

        cli.closeResources();
    }

    private void initManagers() {
        templateManager = new TemplateManager();
        schemaManager = new SchemaManager();
        System.out.println("[OK] 模板管理器已初始化");
        System.out.println("[OK] Schema 管理器已初始化");
    }

    private void initConfig() throws Exception {
        currentConfig = new MQConfig();
        currentConfig.setType(MQType.fromString(mqType));

        if (currentConfig.getType() == MQType.RABBITMQ) {
            currentConfig = MQConfig.rabbitMqDefault();
            if (host != null) currentConfig.setHost(host);
            if (port > 0) currentConfig.setPort(port);
            currentConfig.setUsername(username);
            currentConfig.setPassword(password);
        } else if (currentConfig.getType() == MQType.KAFKA) {
            currentConfig = MQConfig.kafkaDefault();
            if (bootstrapServers != null) {
                currentConfig.setBootstrapServers(bootstrapServers);
            }
        }

        System.out.printf("[OK] MQ配置已初始化: %s%n", currentConfig.getType().getDisplayName());
    }

    private void executeOperation() throws Exception {
        switch (operation.toLowerCase()) {
            case "send":
                handleSend();
                break;
            case "consume":
                handleConsume();
                break;
            case "template":
                handleTemplate();
                break;
            case "schedule":
                handleSchedule();
                break;
            case "record":
                handleRecord();
                break;
            case "replay":
                handleReplay();
                break;
            case "dlq":
                handleDLQ();
                break;
            case "delay":
                handleDelay();
                break;
            case "filter":
                handleFilter();
                break;
            default:
                System.out.printf("未知操作: %s%n", operation);
                printAvailableOperations();
        }
    }

    private void handleSend() throws Exception {
        if (currentSender == null) {
            currentSender = MessageSenderFactory.createSender(currentConfig);
            currentSender.init(currentConfig);
            currentSender.connect();
        }

        Message msg = createMessage();

        System.out.printf("开始发送消息... (数量: %d, 格式: %s)%n", count, format);

        for (int i = 0; i < count; i++) {
            if (i > 0 && interval > 0) {
                Thread.sleep(interval);
            }

            msg.setId(UUID.randomUUID().toString());
            SendResult result = currentSender.send(msg);
            System.out.printf("[%d] %s%n", i + 1, result);
        }

        System.out.printf("[OK] 消息发送完成，共 %d 条%n", count);
    }

    private void handleConsume() throws Exception {
        if (topic == null || topic.isEmpty()) {
            System.out.println("[ERROR] 请指定 --topic 参数");
            return;
        }

        if (currentConsumer == null) {
            currentConsumer = MessageConsumerFactory.createConsumer(currentConfig);
            currentConsumer.init(currentConfig);
            currentConsumer.connect();
        }

        currentConsumer.subscribe(topic);

        System.out.printf("开始消费主题: %s (按 Ctrl+C 停止)%n", topic);
        System.out.println("────────────────────────────────────────");

        currentConsumer.start(msg -> {
            if (currentFilter != null && !currentFilter.matches(msg)) {
                return;
            }

            System.out.printf("[%s] Topic: %s, Offset: %d, Partition: %d%n",
                    LocalDateTime.now().format(DATE_FORMATTER),
                    msg.getTopic(), msg.getOffset(), msg.getPartition());
            System.out.printf("  ID: %s%n", msg.getMessageId());
            System.out.printf("  Content: %s%n", truncate(msg.getContent(), 200));
            System.out.println("────────────────────────────────────────");
        });

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\n正在停止消费...");
            try {
                currentConsumer.stop();
            } catch (Exception e) {
                logger.error("停止消费失败", e);
            }
        }));

        Thread.sleep(Long.MAX_VALUE);
    }

    private void handleTemplate() throws Exception {
        System.out.println("\n=== 消息模板管理 ===");

        List<MessageTemplate> templates = templateManager.listTemplates();
        System.out.printf("可用模板 (%d 个):%n", templates.size());

        for (MessageTemplate t : templates) {
            System.out.printf("  - %s (%s) [%s]%n", t.getName(), t.getCategory(),
                    t.getFormat() != null ? t.getFormat().getDisplayName() : "N/A");
        }

        if (templateName != null) {
            MessageTemplate t = templateManager.getTemplateByName(templateName);
            if (t != null) {
                System.out.printf("%n模板详情: %s%n", t.getName());
                System.out.printf("  描述: %s%n", t.getDescription());
                System.out.printf("  默认主题: %s%n", t.getDefaultTopic());
                System.out.printf("  占位符: %s%n", t.getPlaceholders().keySet());
                System.out.printf("%n  内容示例:%n%s%n", t.getContent());

                if (message == null || message.isEmpty()) {
                    Message msg = templateManager.applyTemplate(t);
                    System.out.printf("%n  渲染后内容:%n%s%n", formatJson(msg.getContent()));

                    if (topic != null) {
                        msg.setTopic(topic);
                        if (currentSender == null) {
                            currentSender = MessageSenderFactory.createSender(currentConfig);
                            currentSender.init(currentConfig);
                            currentSender.connect();
                        }
                        SendResult result = currentSender.send(msg);
                        System.out.printf("%n[OK] 已发送模板消息: %s%n", result);
                    }
                }
            } else {
                System.out.printf("[ERROR] 未找到模板: %s%n", templateName);
            }
        }
    }

    private void handleTemplateImport() throws Exception {
        System.out.println("\n=== 导入模板 ===");
        System.out.println("导入文件: " + templateImport);

        MessageTemplate template = templateManager.importTemplate(templateImport);

        System.out.println("[OK] 模板导入成功!");
        System.out.printf("  名称: %s%n", template.getName());
        System.out.printf("  分类: %s%n", template.getCategory());
        System.out.printf("  ID: %s%n", template.getId());
        System.out.printf("  描述: %s%n", template.getDescription());
    }

    private void handleTemplateExport() throws Exception {
        System.out.println("\n=== 导出模板 ===");
        System.out.println("模板名称: " + templateExport);

        MessageTemplate template = templateManager.getTemplateByName(templateExport);
        if (template == null) {
            System.out.println("[ERROR] 未找到模板: " + templateExport);
            return;
        }

        String exportFile = templateExportFile;
        if (exportFile == null || exportFile.isEmpty()) {
            exportFile = template.getName().replaceAll("[^a-zA-Z0-9\\u4e00-\\u9fa5]", "_") + ".json";
        }

        templateManager.exportTemplate(template.getId(), exportFile);

        System.out.println("[OK] 模板导出成功!");
        System.out.printf("  名称: %s%n", template.getName());
        System.out.printf("  导出文件: %s%n", exportFile);
    }

    private void handleSchedule() throws Exception {
        if (scheduler == null) {
            scheduler = new MessageScheduler(currentConfig);
        }

        Message msg = createMessage();

        scheduler.setResultHandler(result -> {
            System.out.printf("[%s] %s%n", LocalDateTime.now().format(DATE_FORMATTER), result);
        });

        System.out.println("=== 定时发送任务 ===");

        if (rate > 0) {
            System.out.printf("启动速率控制发送: %d 条/秒, 持续 %d 秒%n", rate, 60);
            scheduler.scheduleCustomRate(msg, rate, 60000);
        } else if (interval > 0 && count > 0) {
            long duration = interval * count;
            System.out.printf("启动间隔发送: 每 %dms 1条, 共 %d 条%n", interval, count);
            scheduler.scheduleAtInterval(msg, (int) (1000 / Math.max(1, interval / 1000)), duration, true);
        } else {
            System.out.printf("启动突发发送: %d 条%n", count);
            scheduler.scheduleBurst(msg, count, 1000);
        }

        System.out.println("任务执行中... (按 Ctrl+C 停止)");
        Thread.sleep(Long.MAX_VALUE);
    }

    private void handleRecord() throws Exception {
        if (topic == null || topic.isEmpty()) {
            System.out.println("[ERROR] 请指定 --topic 参数");
            return;
        }

        if (trafficRecorder == null) {
            trafficRecorder = new TrafficRecorder(currentConfig);
        }

        System.out.printf("开始录制流量: %s (输入 'stop' 停止)%n", topic);

        trafficRecorder.setRecordingListener(msg -> {
            System.out.printf("[REC] %s | %s | %s%n",
                    LocalDateTime.now().format(DATE_FORMATTER),
                    msg.getTopic(),
                    truncate(msg.getContent(), 100));
        });

        trafficRecorder.startRecording(Collections.singletonList(topic), null);

        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = reader.readLine()) != null) {
            if ("stop".equalsIgnoreCase(line.trim())) {
                break;
            }
        }

        List<com.mq.simulator.model.RecordedMessage> recorded = trafficRecorder.stopRecording();
        System.out.printf("[OK] 录制完成，共 %d 条消息%n", recorded.size());

        if (!recorded.isEmpty()) {
            String savePath = trafficRecorder.saveRecording("recording_" + System.currentTimeMillis());
            System.out.printf("[OK] 已保存到: %s%n", savePath);
        }
    }

    private void handleReplay() throws Exception {
        if (trafficRecorder == null) {
            trafficRecorder = new TrafficRecorder(currentConfig);
        }

        List<TrafficRecorder.RecordingPackage> recordings = trafficRecorder.listRecordings();
        System.out.println("=== 可用的录制文件 ===");
        for (int i = 0; i < recordings.size(); i++) {
            TrafficRecorder.RecordingPackage pkg = recordings.get(i);
            System.out.printf("[%d] %s - %s (%d 条消息)%n", i, pkg.getName(),
                    pkg.getRecordedAt().format(DATE_FORMATTER), pkg.getMessageCount());
        }

        if (recordings.isEmpty()) {
            System.out.println("没有可用的录制文件，请先录制流量");
            return;
        }

        TrafficRecorder.ReplayOptions options = new TrafficRecorder.ReplayOptions()
                .setLoopCount(1)
                .setSpeedMultiplier(1.0);

        if (topic != null) {
            options.setTargetTopic(topic);
        }

        System.out.printf("%n开始回放: %s%n", recordings.get(0).getName());
        trafficRecorder.setReplayResultListener(result -> {
            System.out.printf("[REPLAY] %s%n", result);
        });

        trafficRecorder.startReplay(recordings.get(0).getFilePath(), options);

        System.out.println("回放执行中... (输入 'stop' 停止)");
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = reader.readLine()) != null) {
            if ("stop".equalsIgnoreCase(line.trim())) {
                break;
            }
        }

        trafficRecorder.stopReplay();
        System.out.printf("[OK] 回放完成，共 %d 条%n", trafficRecorder.getReplayedCount());
    }

    private void handleDLQ() throws Exception {
        if (dlqManager == null) {
            dlqManager = new DeadLetterQueueManager(currentConfig);
            dlqManager.start();
        }

        System.out.println("\n=== 死信队列管理 ===");
        System.out.printf("当前 DLQ 大小: %d%n", dlqManager.getDLQSize());

        List<DeadLetterQueueManager.DLQEntry> entries = dlqManager.listDLQEntries();
        for (int i = 0; i < Math.min(10, entries.size()); i++) {
            DeadLetterQueueManager.DLQEntry entry = entries.get(i);
            System.out.printf("[%d] %s | %s | %s%n", i,
                    entry.getOriginalMessageId(),
                    entry.getStatus(),
                    truncate(entry.getErrorMessage(), 50));
        }

        if (!entries.isEmpty()) {
            System.out.printf("%n重新处理第一条消息...%n");
            DeadLetterQueueManager.ReprocessResult result = dlqManager.reprocessMessage(entries.get(0).getId());
            System.out.printf("处理结果: %s%n", result.getSendResult());
        }
    }

    private void handleDelay() throws Exception {
        if (delayManager == null) {
            delayManager = new DelayMessageManager(currentConfig);
            delayManager.start();
        }

        Message msg = createMessage();
        long delay = delayMs > 0 ? delayMs :
                (delayLevel != null ? DelayLevel.fromLevel(delayLevel).getDelayMillis() : 5000);

        System.out.printf("发送延迟消息: 延迟 %dms%n", delay);

        delayManager.setResultHandler(result -> {
            System.out.printf("[DELAY-SENT] %s%n", result);
        });

        DelayMessageManager.DelayMessageTracker tracker = delayManager.sendDelayedMessage(msg, delay);
        System.out.printf("[OK] 消息已加入延迟队列: %s%n", tracker.getMessageId());
        System.out.printf("预计发送时间: %s%n",
                LocalDateTime.now().plusNanos(delay * 1_000_000).format(DATE_FORMATTER));

        System.out.println("等待消息发送... (按 Ctrl+C 停止)");
        Thread.sleep(delay + 2000);
    }

    private void handleFilter() {
        System.out.println("\n=== 消息过滤配置 ===");
        currentFilter = new MessageFilter();

        if (message != null && !message.isEmpty()) {
            currentFilter.addContentContains(message);
            System.out.printf("已添加内容过滤: 包含 '%s'%n", message);
        }

        if (topic != null && !topic.isEmpty()) {
            currentFilter.addTopicMatches(topic);
            System.out.printf("已添加主题过滤: 匹配 '%s'%n", topic);
        }

        System.out.printf("过滤条件已配置，共 %d 条规则%n",
                currentFilter.getConditionCount());
        for (MessageFilter.FilterCondition condition : currentFilter.getConditions()) {
            System.out.printf("  - %s%n", condition.getDescription());
        }
        System.out.println("过滤将在消费时生效");
    }

    private Message createMessage() {
        Message msg = new Message();
        msg.setMqType(currentConfig.getType());
        msg.setFormat(MessageFormat.fromString(format));
        msg.setTopic(topic != null ? topic : "test.topic");

        if (templateName != null && !templateName.isEmpty()) {
            MessageTemplate t = templateManager.getTemplateByName(templateName);
            if (t != null) {
                Message templateMsg = templateManager.applyTemplate(t);
                msg.setContent(templateMsg.getContent());
                msg.getHeaders().putAll(templateMsg.getHeaders());
            }
        } else if (message != null && !message.isEmpty()) {
            msg.setContent(message);
        } else {
            msg.setContent(createSampleContent());
        }

        if (delayLevel != null) {
            msg.setDelayLevel(DelayLevel.fromLevel(delayLevel));
        }
        if (delayMs > 0) {
            msg.setCustomDelayMillis(delayMs);
        }

        msg.addHeader("source", "mq-simulator");
        msg.addHeader("createdAt", LocalDateTime.now().toString());

        return msg;
    }

    private String createSampleContent() {
        Map<String, Object> data = new HashMap<>();
        data.put("id", UUID.randomUUID().toString());
        data.put("timestamp", System.currentTimeMillis());
        data.put("type", "test");
        data.put("data", Collections.singletonMap("message", "Hello MQ Simulator"));

        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(data);
        } catch (Exception e) {
            return "{\"message\":\"Hello MQ Simulator\"}";
        }
    }

    private void runInteractiveMode() throws Exception {
        System.out.println("\n进入交互模式，输入 'help' 查看可用命令");
        System.out.println("────────────────────────────────────────");

        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;

        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;

            String[] parts = line.split("\\s+", 2);
            String cmd = parts[0].toLowerCase();
            String args = parts.length > 1 ? parts[1] : "";

            try {
                switch (cmd) {
                    case "help":
                        printHelp();
                        break;
                    case "quit":
                    case "exit":
                        System.out.println("再见！");
                        return;
                    case "config":
                        System.out.printf("当前配置: %s%n", currentConfig);
                        break;
                    case "send":
                        topic = args.isEmpty() ? "test.topic" : args;
                        handleSend();
                        break;
                    case "consume":
                        topic = args.isEmpty() ? "test.topic" : args;
                        handleConsume();
                        break;
                    case "templates":
                        handleTemplate();
                        break;
                    case "status":
                        printStatus();
                        break;
                    default:
                        System.out.printf("未知命令: %s，输入 'help' 查看帮助%n", cmd);
                }
            } catch (Exception e) {
                System.out.printf("[ERROR] %s%n", e.getMessage());
                logger.error("命令执行失败", e);
            }

            System.out.println();
        }
    }

    private void printHelp() {
        System.out.println("可用命令:");
        System.out.println("  help              - 显示帮助信息");
        System.out.println("  send [topic]      - 发送测试消息");
        System.out.println("  consume [topic]   - 消费指定主题");
        System.out.println("  templates         - 查看消息模板");
        System.out.println("  config            - 查看当前配置");
        System.out.println("  status            - 查看运行状态");
        System.out.println("  quit/exit         - 退出程序");
        System.out.println("\n操作示例:");
        System.out.println("  java -jar mq-simulator.jar -o send --topic order.created -m '{\"id\":1}'");
        System.out.println("  java -jar mq-simulator.jar -o consume --topic order.*");
        System.out.println("  java -jar mq-simulator.jar -o template --template \"订单创建\"");
        System.out.println("  java -jar mq-simulator.jar -o schedule --rate 100 --topic test");
        System.out.println("  java -jar mq-simulator.jar -o record --topic order.created");
        System.out.println("  java -jar mq-simulator.jar -o delay --delay-level 3 --topic test");
    }

    private void printAvailableOperations() {
        System.out.println("\n可用操作类型 (--operation / -o):");
        System.out.println("  send      - 发送消息");
        System.out.println("  consume   - 消费消息");
        System.out.println("  template  - 模板管理");
        System.out.println("  schedule  - 定时/速率发送");
        System.out.println("  record    - 流量录制");
        System.out.println("  replay    - 流量回放");
        System.out.println("  dlq       - 死信队列管理");
        System.out.println("  delay     - 延迟消息");
        System.out.println("  filter    - 消息过滤配置");
        System.out.println("  server    - 启动 HTTP 服务器 (配合 --server-port 指定端口)");
        System.out.println("  gui       - 启动 GUI 界面");
        System.out.println("\n模板导入导出:");
        System.out.println("  --template-export \"模板名称\"              导出模板");
        System.out.println("  --template-export-file 导出路径            指定导出文件");
        System.out.println("  --template-import 文件路径                 导入模板");
    }

    private void printStatus() {
        System.out.println("=== 系统状态 ===");
        System.out.printf("MQ类型: %s%n", currentConfig.getType().getDisplayName());
        System.out.printf("发送器连接: %s%n", currentSender != null && currentSender.isConnected() ? "已连接" : "未连接");
        System.out.printf("消费者运行: %s%n", currentConsumer != null && currentConsumer.isRunning() ? "运行中" : "已停止");
        System.out.printf("模板数量: %d%n", templateManager.listTemplates().size());
        System.out.printf("录制中: %s (已录制: %d)%n",
                trafficRecorder != null && trafficRecorder.isRecording() ? "是" : "否",
                trafficRecorder != null ? trafficRecorder.getRecordedCount() : 0);
        System.out.printf("回放中: %s (已回放: %d)%n",
                trafficRecorder != null && trafficRecorder.isReplaying() ? "是" : "否",
                trafficRecorder != null ? trafficRecorder.getReplayedCount() : 0);
        System.out.printf("DLQ大小: %d%n", dlqManager != null ? dlqManager.getDLQSize() : 0);
        System.out.printf("延迟队列: %d%n", delayManager != null ? delayManager.getPendingCount() : 0);
    }

    private void closeResources() {
        try {
            if (scheduler != null) scheduler.close();
            if (delayManager != null) delayManager.close();
            if (dlqManager != null) dlqManager.close();
            if (trafficRecorder != null) trafficRecorder.close();
            if (currentConsumer != null) currentConsumer.close();
            if (currentSender != null) currentSender.close();
        } catch (Exception e) {
            logger.warn("关闭资源时出错", e);
        }
    }

    private static String truncate(String str, int maxLen) {
        if (str == null) return "null";
        if (str.length() <= maxLen) return str;
        return str.substring(0, maxLen) + "...";
    }

    private static String formatJson(String json) {
        try {
            if (json == null || json.trim().isEmpty()) return json;
            Object obj = objectMapper.readValue(json, Object.class);
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (Exception e) {
            return json;
        }
    }
}
