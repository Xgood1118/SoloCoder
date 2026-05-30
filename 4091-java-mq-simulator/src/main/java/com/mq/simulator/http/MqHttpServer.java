package com.mq.simulator.http;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mq.simulator.config.MQConfig;
import com.mq.simulator.core.DelayLevel;
import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.core.MQType;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.MessageTemplate;
import com.mq.simulator.model.SendResult;
import com.mq.simulator.schema.SchemaManager;
import com.mq.simulator.sender.MessageSender;
import com.mq.simulator.sender.MessageSenderFactory;
import com.mq.simulator.template.TemplateManager;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.FullHttpResponse;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpMethod;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.codec.http.QueryStringDecoder;
import io.netty.handler.stream.ChunkedWriteHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MqHttpServer implements AutoCloseable {
    private static final Logger logger = LoggerFactory.getLogger(MqHttpServer.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final int port;
    private final MQConfig defaultConfig;
    private final TemplateManager templateManager;
    private final SchemaManager schemaManager;
    private final Map<String, MessageSender> senderCache = new ConcurrentHashMap<>();

    private Channel serverChannel;
    private NioEventLoopGroup bossGroup;
    private NioEventLoopGroup workerGroup;
    private volatile boolean running = false;

    public MqHttpServer(int port, MQConfig defaultConfig) {
        this.port = port;
        this.defaultConfig = defaultConfig;
        this.templateManager = new TemplateManager();
        this.schemaManager = new SchemaManager();
    }

    public void start() throws Exception {
        bossGroup = new NioEventLoopGroup(1);
        workerGroup = new NioEventLoopGroup();

        ServerBootstrap b = new ServerBootstrap();
        b.group(bossGroup, workerGroup)
                .channel(NioServerSocketChannel.class)
                .childHandler(new ChannelInitializer<SocketChannel>() {
                    @Override
                    protected void initChannel(SocketChannel ch) {
                        ch.pipeline()
                                .addLast(new HttpServerCodec())
                                .addLast(new HttpObjectAggregator(10 * 1024 * 1024))
                                .addLast(new ChunkedWriteHandler())
                                .addLast(new MqHttpHandler());
                    }
                })
                .option(ChannelOption.SO_BACKLOG, 128)
                .childOption(ChannelOption.SO_KEEPALIVE, true);

        ChannelFuture f = b.bind(port).sync();
        serverChannel = f.channel();
        running = true;

        logger.info("MQ HTTP Server started on port {}", port);
        System.out.printf("[OK] HTTP 服务已启动: http://localhost:%d%n", port);
        System.out.println("    API 文档: http://localhost:" + port + "/api/help");
    }

    public void waitForShutdown() throws InterruptedException {
        if (serverChannel != null) {
            serverChannel.closeFuture().sync();
        }
    }

    public void stop() {
        running = false;
        if (serverChannel != null) {
            serverChannel.close();
        }
        if (bossGroup != null) {
            bossGroup.shutdownGracefully();
        }
        if (workerGroup != null) {
            workerGroup.shutdownGracefully();
        }
        senderCache.values().forEach(sender -> {
            try {
                sender.close();
            } catch (Exception e) {
                logger.warn("Error closing sender: {}", e.getMessage());
            }
        });
        senderCache.clear();
        logger.info("MQ HTTP Server stopped");
    }

    @Override
    public void close() {
        stop();
    }

    private class MqHttpHandler extends ChannelInboundHandlerAdapter {
        @Override
        public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
            if (msg instanceof FullHttpRequest) {
                FullHttpRequest req = (FullHttpRequest) msg;
                try {
                    ApiResponse<?> response = handleRequest(req);
                    sendResponse(ctx, response, HttpResponseStatus.valueOf(response.getCode()));
                } catch (Exception e) {
                    logger.error("Error handling request: {}", e.getMessage(), e);
                    sendResponse(ctx, ApiResponse.error(e.getMessage()), HttpResponseStatus.INTERNAL_SERVER_ERROR);
                } finally {
                    req.release();
                }
            }
        }

        private ApiResponse<?> handleRequest(FullHttpRequest req) throws Exception {
            String uri = req.uri();
            HttpMethod method = req.method();
            String path = uri.contains("?") ? uri.substring(0, uri.indexOf('?')) : uri;

            logger.info("HTTP Request: {} {}", method, path);

            Map<String, String> params = parseQueryParams(uri);
            String body = parseBody(req);

            if (path.startsWith("/api/dlq/") && path.endsWith("/reprocess")) {
                if (method == HttpMethod.POST) {
                    String id = path.substring("/api/dlq/".length(), path.length() - "/reprocess".length());
                    return handleDlqReprocess(id);
                }
                return ApiResponse.error(405, "Method not allowed");
            }

            switch (path) {
                case "/":
                case "/index.html":
                    return handleWebUi();
                case "/api/help":
                    return handleApiHelp();
                case "/api/status":
                    return handleStatus();

                case "/api/send":
                    if (method == HttpMethod.POST) return handleSend(body, params);
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/send/batch":
                    if (method == HttpMethod.POST) return handleSendBatch(body, params);
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/schedule":
                    if (method == HttpMethod.POST) return handleSchedule(body);
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/delay":
                    if (method == HttpMethod.POST) return handleDelaySend(body);
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/dlq":
                    if (method == HttpMethod.GET) return handleDlqStatus();
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/templates":
                    if (method == HttpMethod.GET) return handleListTemplates(params);
                    if (method == HttpMethod.POST) return handleAddTemplate(body);
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/templates/export":
                    if (method == HttpMethod.GET) return handleExportTemplate(params);
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/templates/import":
                    if (method == HttpMethod.POST) return handleImportTemplate(body);
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/schemas":
                    if (method == HttpMethod.GET) return handleListSchemas();
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/schemas/infer":
                    if (method == HttpMethod.POST) return handleInferSchema(body, params);
                    return ApiResponse.error(405, "Method not allowed");

                case "/api/delay-levels":
                    return handleListDelayLevels();

                case "/api/mq-types":
                    return handleListMqTypes();

                case "/api/formats":
                    return handleListFormats();

                default:
                    return ApiResponse.error(404, "Not found: " + path);
            }
        }

        private ApiResponse<?> handleWebUi() {
            String html = buildWebUiHtml();
            return ApiResponse.success(html);
        }

        private ApiResponse<?> handleApiHelp() {
            Map<String, Object> apiInfo = new HashMap<>();
            apiInfo.put("name", "MQ Simulator HTTP API");
            apiInfo.put("version", "1.0.0");
            Map<String, String> endpoints = new HashMap<>();
            endpoints.put("GET /", "Web UI");
            endpoints.put("GET /api/status", "Get server status");
            endpoints.put("POST /api/send", "Send message");
            endpoints.put("POST /api/send/batch", "Send batch messages");
            endpoints.put("POST /api/schedule", "Schedule message sending");
            endpoints.put("POST /api/delay", "Send delayed message");
            endpoints.put("GET /api/dlq", "Get dead letter queue status");
            endpoints.put("POST /api/dlq/{id}/reprocess", "Reprocess message from DLQ");
            endpoints.put("GET /api/templates", "List all templates");
            endpoints.put("POST /api/templates", "Add new template");
            endpoints.put("GET /api/templates/export", "Export template by ID");
            endpoints.put("POST /api/templates/import", "Import template");
            endpoints.put("GET /api/schemas", "List all schemas");
            endpoints.put("POST /api/schemas/infer", "Infer Avro schema from JSON");
            endpoints.put("GET /api/delay-levels", "List all delay levels");
            endpoints.put("GET /api/mq-types", "List supported MQ types");
            endpoints.put("GET /api/formats", "List supported message formats");
            apiInfo.put("endpoints", endpoints);
            return ApiResponse.success(apiInfo);
        }

        private ApiResponse<?> handleStatus() {
            Map<String, Object> status = new HashMap<>();
            status.put("status", "running");
            status.put("port", port);
            status.put("defaultMqType", defaultConfig.getType().name());
            status.put("templateCount", templateManager.listTemplates().size());
            status.put("avroSchemaCount", schemaManager.listAvroSchemas().size());
            status.put("protobufSchemaCount", schemaManager.listProtobufSchemas().size());
            status.put("activeSenders", senderCache.size());
            status.put("startTime", LocalDateTime.now().toString());
            return ApiResponse.success(status);
        }

        @SuppressWarnings("unchecked")
        private ApiResponse<?> handleSend(String body, Map<String, String> params) throws Exception {
            Map<String, Object> request = objectMapper.readValue(body, Map.class);

            MQType mqType = MQType.fromString((String) request.getOrDefault("mqType", defaultConfig.getType().name()));
            String topic = (String) request.get("topic");
            String content = (String) request.get("content");
            String format = (String) request.getOrDefault("format", "JSON");

            if (topic == null || topic.isEmpty()) {
                return ApiResponse.error(400, "Topic is required");
            }
            if (content == null || content.isEmpty()) {
                return ApiResponse.error(400, "Content is required");
            }

            MQConfig config = buildConfig(mqType, request);
            MessageSender sender = getOrCreateSender(config);

            Message message = new Message();
            message.setId(UUID.randomUUID().toString());
            message.setMqType(mqType);
            message.setFormat(MessageFormat.fromString(format));
            message.setTopic(topic);
            message.setContent(content);

            Map<String, String> headers = (Map<String, String>) request.get("headers");
            if (headers != null) {
                message.getHeaders().putAll(headers);
            }

            Integer delayLevel = (Integer) request.get("delayLevel");
            if (delayLevel != null) {
                message.setDelayLevel(DelayLevel.fromLevel(delayLevel));
            }

            Long delayMs = (Long) request.get("delayMs");
            if (delayMs != null) {
                message.setCustomDelayMillis(delayMs);
            }

            SendResult result = sender.send(message);

            Map<String, Object> data = new HashMap<>();
            data.put("messageId", message.getId());
            data.put("success", result.isSuccess());
            data.put("result", result);

            return ApiResponse.success("Message sent successfully", data);
        }

        @SuppressWarnings("unchecked")
        private ApiResponse<?> handleSendBatch(String body, Map<String, String> params) throws Exception {
            Map<String, Object> request = objectMapper.readValue(body, Map.class);

            MQType mqType = MQType.fromString((String) request.getOrDefault("mqType", defaultConfig.getType().name()));
            String topic = (String) request.get("topic");
            List<String> contents = (List<String>) request.get("contents");

            if (topic == null || topic.isEmpty()) {
                return ApiResponse.error(400, "Topic is required");
            }
            if (contents == null || contents.isEmpty()) {
                return ApiResponse.error(400, "Contents is required");
            }

            MQConfig config = buildConfig(mqType, request);
            MessageSender sender = getOrCreateSender(config);

            List<Message> messages = new java.util.ArrayList<>();
            for (String content : contents) {
                Message message = new Message();
                message.setId(UUID.randomUUID().toString());
                message.setMqType(mqType);
                message.setFormat(MessageFormat.JSON);
                message.setTopic(topic);
                message.setContent(content);
                messages.add(message);
            }

            List<SendResult> results = sender.sendBatch(messages);

            long successCount = results.stream().filter(SendResult::isSuccess).count();

            Map<String, Object> data = new HashMap<>();
            data.put("total", contents.size());
            data.put("success", successCount);
            data.put("failed", contents.size() - successCount);
            data.put("results", results);

            return ApiResponse.success("Batch send completed", data);
        }

        private ApiResponse<?> handleListTemplates(Map<String, String> params) {
            String category = params.get("category");
            List<MessageTemplate> templates;
            if (category != null && !category.isEmpty()) {
                templates = templateManager.listTemplatesByCategory(category);
            } else {
                templates = templateManager.listTemplates();
            }
            return ApiResponse.success(templates);
        }

        @SuppressWarnings("unchecked")
        private ApiResponse<?> handleAddTemplate(String body) throws Exception {
            MessageTemplate template = objectMapper.readValue(body, MessageTemplate.class);
            template = templateManager.addTemplate(template);
            return ApiResponse.success("Template added", template);
        }

        private ApiResponse<?> handleExportTemplate(Map<String, String> params) throws Exception {
            String id = params.get("id");
            String name = params.get("name");

            MessageTemplate template;
            if (id != null && !id.isEmpty()) {
                template = templateManager.getTemplate(id);
            } else if (name != null && !name.isEmpty()) {
                template = templateManager.getTemplateByName(name);
            } else {
                return ApiResponse.error(400, "Template id or name is required");
            }

            if (template == null) {
                return ApiResponse.error(404, "Template not found");
            }

            return ApiResponse.success(template);
        }

        @SuppressWarnings("unchecked")
        private ApiResponse<?> handleImportTemplate(String body) throws Exception {
            Map<String, Object> request = objectMapper.readValue(body, Map.class);
            String filePath = (String) request.get("filePath");
            String jsonContent = (String) request.get("content");

            MessageTemplate template;
            if (filePath != null && !filePath.isEmpty()) {
                template = templateManager.importTemplate(filePath);
            } else if (jsonContent != null && !jsonContent.isEmpty()) {
                template = objectMapper.readValue(jsonContent, MessageTemplate.class);
                template = templateManager.addTemplate(template);
            } else {
                return ApiResponse.error(400, "filePath or content is required");
            }

            return ApiResponse.success("Template imported successfully", template);
        }

        private ApiResponse<?> handleListSchemas() {
            Map<String, Object> data = new HashMap<>();
            data.put("avro", schemaManager.listAvroSchemas());
            data.put("protobuf", schemaManager.listProtobufSchemas());
            return ApiResponse.success(data);
        }

        @SuppressWarnings("unchecked")
        private ApiResponse<?> handleInferSchema(String body, Map<String, String> params) throws Exception {
            Map<String, Object> request = objectMapper.readValue(body, Map.class);
            String jsonContent = (String) request.get("jsonContent");
            String schemaName = (String) request.getOrDefault("schemaName", "InferredSchema");

            if (jsonContent == null || jsonContent.isEmpty()) {
                return ApiResponse.error(400, "jsonContent is required");
            }

            String schemaJson = schemaManager.inferAvroSchemaFromJson(jsonContent, schemaName);

            Map<String, Object> data = new HashMap<>();
            data.put("schemaName", schemaName);
            data.put("schema", objectMapper.readTree(schemaJson));

            return ApiResponse.success("Schema inferred successfully", data);
        }

        private ApiResponse<?> handleListDelayLevels() {
            List<Map<String, Object>> levels = new java.util.ArrayList<>();
            for (DelayLevel level : DelayLevel.values()) {
                Map<String, Object> m = new HashMap<>();
                m.put("level", level.getLevel());
                m.put("delayMillis", level.getDelayMillis());
                m.put("description", level.getDuration() + " " + level.getUnit().name().toLowerCase());
                levels.add(m);
            }
            return ApiResponse.success(levels);
        }

        private ApiResponse<?> handleListMqTypes() {
            List<Map<String, Object>> types = new java.util.ArrayList<>();
            for (MQType type : MQType.values()) {
                Map<String, Object> m = new HashMap<>();
                m.put("name", type.name());
                m.put("displayName", type.getDisplayName());
                types.add(m);
            }
            return ApiResponse.success(types);
        }

        private ApiResponse<?> handleListFormats() {
            List<Map<String, Object>> formats = new java.util.ArrayList<>();
            for (MessageFormat format : MessageFormat.values()) {
                Map<String, Object> m = new HashMap<>();
                m.put("name", format.name());
                m.put("displayName", format.getDisplayName());
                formats.add(m);
            }
            return ApiResponse.success(formats);
        }

        @SuppressWarnings("unchecked")
        private ApiResponse<?> handleSchedule(String body) throws Exception {
            Map<String, Object> request = objectMapper.readValue(body, Map.class);

            String strategy = (String) request.getOrDefault("strategy", "interval");
            String topic = (String) request.get("topic");
            String content = (String) request.getOrDefault("content", "{}");
            int count = ((Number) request.getOrDefault("count", 1)).intValue();
            long intervalMs = ((Number) request.getOrDefault("interval", 1000)).longValue();
            int ratePerSecond = ((Number) request.getOrDefault("rate", 0)).intValue();
            long warmupSeconds = ((Number) request.getOrDefault("warmupSeconds", 60)).longValue();

            if (topic == null || topic.isEmpty()) {
                return ApiResponse.error(400, "Topic is required");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("strategy", strategy);
            result.put("topic", topic);
            result.put("count", count);

            switch (strategy.toLowerCase()) {
                case "interval":
                    result.put("intervalMs", intervalMs);
                    result.put("description", "Send " + count + " messages with " + intervalMs + "ms interval");
                    break;
                case "burst":
                    result.put("description", "Burst send " + count + " messages");
                    break;
                case "warmup":
                    result.put("targetRate", ratePerSecond);
                    result.put("warmupSeconds", warmupSeconds);
                    result.put("description", "Warmup to " + ratePerSecond + " msg/s over " + warmupSeconds + "s");
                    break;
                case "rate":
                    result.put("ratePerSecond", ratePerSecond);
                    result.put("description", "Send at " + ratePerSecond + " msg/s");
                    break;
                default:
                    return ApiResponse.error(400, "Unknown strategy: " + strategy + ". Use: interval, burst, warmup, rate");
            }

            MQType mqType = MQType.fromString((String) request.getOrDefault("mqType", defaultConfig.getType().name()));
            MQConfig config = buildConfig(mqType, request);
            MessageSender sender = getOrCreateSender(config);

            com.mq.simulator.scheduler.MessageScheduler scheduler =
                    new com.mq.simulator.scheduler.MessageScheduler(config);

            Message msg = new Message();
            msg.setId(UUID.randomUUID().toString());
            msg.setMqType(mqType);
            msg.setFormat(MessageFormat.fromString((String) request.getOrDefault("format", "JSON")));
            msg.setTopic(topic);
            msg.setContent(content);

            Map<String, String> headers = (Map<String, String>) request.get("headers");
            if (headers != null) {
                msg.getHeaders().putAll(headers);
            }

            java.util.concurrent.atomic.AtomicInteger successCount = new java.util.concurrent.atomic.AtomicInteger(0);
            java.util.concurrent.atomic.AtomicInteger failCount = new java.util.concurrent.atomic.AtomicInteger(0);

            scheduler.setResultHandler(r -> {
                if (r.isSuccess()) successCount.incrementAndGet();
                else failCount.incrementAndGet();
            });

            switch (strategy.toLowerCase()) {
                case "interval":
                    scheduler.scheduleAtInterval(msg, (int) Math.max(1, 1000.0 / Math.max(1, intervalMs)),
                            intervalMs * count, true);
                    break;
                case "burst":
                    scheduler.scheduleBurst(msg, count, 0);
                    break;
                case "warmup":
                    scheduler.scheduleWarmup(msg, 1, ratePerSecond, (int) warmupSeconds, (int) warmupSeconds + 60);
                    break;
                case "rate":
                    scheduler.scheduleCustomRate(msg, ratePerSecond, 60000);
                    break;
            }

            result.put("status", "scheduled");
            result.put("message", "Schedule task started successfully");

            return ApiResponse.success("Schedule task created", result);
        }

        @SuppressWarnings("unchecked")
        private ApiResponse<?> handleDelaySend(String body) throws Exception {
            Map<String, Object> request = objectMapper.readValue(body, Map.class);

            String topic = (String) request.get("topic");
            String content = (String) request.getOrDefault("content", "{}");
            if (topic == null || topic.isEmpty()) {
                return ApiResponse.error(400, "Topic is required");
            }

            MQType mqType = MQType.fromString((String) request.getOrDefault("mqType", defaultConfig.getType().name()));
            MQConfig config = buildConfig(mqType, request);

            Message msg = new Message();
            msg.setId(UUID.randomUUID().toString());
            msg.setMqType(mqType);
            msg.setFormat(MessageFormat.fromString((String) request.getOrDefault("format", "JSON")));
            msg.setTopic(topic);
            msg.setContent(content);

            int delayLevelVal = ((Number) request.getOrDefault("delayLevel", 0)).intValue();
            long delayMsVal = ((Number) request.getOrDefault("delayMs", 0)).longValue();

            if (delayLevelVal > 0) {
                msg.setDelayLevel(DelayLevel.fromLevel(delayLevelVal));
            }
            if (delayMsVal > 0) {
                msg.setCustomDelayMillis(delayMsVal);
            }

            Map<String, String> headers = (Map<String, String>) request.get("headers");
            if (headers != null) {
                msg.getHeaders().putAll(headers);
            }

            com.mq.simulator.delay.DelayMessageManager delayMgr =
                    new com.mq.simulator.delay.DelayMessageManager(config);
            delayMgr.start();

            com.mq.simulator.delay.DelayMessageManager.DelayMessageTracker tracker;
            if (delayLevelVal > 0) {
                tracker = delayMgr.sendDelayedMessage(msg, DelayLevel.fromLevel(delayLevelVal));
            } else if (delayMsVal > 0) {
                tracker = delayMgr.sendDelayedMessage(msg, delayMsVal);
            } else {
                return ApiResponse.error(400, "Either delayLevel or delayMs must be specified");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("messageId", msg.getId());
            result.put("topic", topic);
            result.put("delayLevel", delayLevelVal);
            result.put("delayMs", delayMsVal);
            result.put("effectiveDelayMs", msg.getEffectiveDelayMillis());
            result.put("status", "delayed");

            return ApiResponse.success("Delayed message submitted", result);
        }

        private ApiResponse<?> handleDlqStatus() {
            com.mq.simulator.dlq.DeadLetterQueueManager dlq =
                    new com.mq.simulator.dlq.DeadLetterQueueManager(defaultConfig);

            Map<String, Object> result = new HashMap<>();
            result.put("totalSize", dlq.getDLQSize());
            result.put("maxRetryCount", dlq.getMaxRetryCount());
            result.put("retryIntervalMs", dlq.getRetryIntervalMs());
            result.put("dlqTopic", dlq.getDlqTopic());
            result.put("entries", dlq.listDLQEntries());

            return ApiResponse.success(result);
        }

        private ApiResponse<?> handleDlqReprocess(String id) {
            com.mq.simulator.dlq.DeadLetterQueueManager dlq =
                    new com.mq.simulator.dlq.DeadLetterQueueManager(defaultConfig);

            try {
                com.mq.simulator.dlq.DeadLetterQueueManager.ReprocessResult rr = dlq.reprocessMessage(id);
                Map<String, Object> result = new HashMap<>();
                result.put("id", id);
                result.put("success", rr.getSendResult() != null && rr.getSendResult().isSuccess());
                result.put("sendResult", rr.getSendResult() != null ? rr.getSendResult().toString() : "unknown");
                if (rr.getSendResult() != null && rr.getSendResult().isSuccess()) {
                    return ApiResponse.success("Message reprocessed successfully", result);
                } else {
                    return ApiResponse.error(500, "Reprocess failed");
                }
            } catch (Exception e) {
                return ApiResponse.error(404, "Message not found or reprocess failed: " + id + " - " + e.getMessage());
            }
        }

        private String buildWebUiHtml() {
            return "<!DOCTYPE html>\n" +
                    "<html lang=\"zh-CN\">\n" +
                    "<head>\n" +
                    "    <meta charset=\"UTF-8\">\n" +
                    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                    "    <title>MQ 消息模拟器</title>\n" +
                    "    <style>\n" +
                    "        * { margin: 0; padding: 0; box-sizing: border-box; }\n" +
                    "        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; }\n" +
                    "        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }\n" +
                    "        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }\n" +
                    "        .tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }\n" +
                    "        .tab-btn { padding: 10px 20px; border: none; background: #e0e0e0; border-radius: 5px; cursor: pointer; font-size: 14px; }\n" +
                    "        .tab-btn.active { background: #667eea; color: white; }\n" +
                    "        .tab-content { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: none; }\n" +
                    "        .tab-content.active { display: block; }\n" +
                    "        .form-group { margin-bottom: 15px; }\n" +
                    "        label { display: block; margin-bottom: 5px; font-weight: 600; color: #333; }\n" +
                    "        input, select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; }\n" +
                    "        textarea { min-height: 150px; font-family: 'Courier New', monospace; }\n" +
                    "        .btn { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }\n" +
                    "        .btn:hover { background: #5568d3; }\n" +
                    "        .btn-success { background: #28a745; }\n" +
                    "        .btn-success:hover { background: #218838; }\n" +
                    "        .result { margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #667eea; }\n" +
                    "        .success { border-left-color: #28a745; }\n" +
                    "        .error { border-left-color: #dc3545; }\n" +
                    "        pre { background: #333; color: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }\n" +
                    "        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }\n" +
                    "        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }\n" +
                    "        .status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #28a745; margin-right: 5px; }\n" +
                    "    </style>\n" +
                    "</head>\n" +
                    "<body>\n" +
                    "    <div class=\"header\">\n" +
                    "        <h1>📡 MQ 消息模拟器</h1>\n" +
                    "        <p><span class=\"status-dot\"></span>服务运行中 | 端口: " + port + "</p>\n" +
                    "    </div>\n" +
                    "    <div class=\"container\">\n" +
                    "        <div class=\"tabs\">\n" +
                    "            <button class=\"tab-btn active\" onclick=\"showTab('send')\">📤 消息发送</button>\n" +
                    "            <button class=\"tab-btn\" onclick=\"showTab('batch')\">📦 批量发送</button>\n" +
                    "            <button class=\"tab-btn\" onclick=\"showTab('templates')\">📋 模板管理</button>\n" +
                    "            <button class=\"tab-btn\" onclick=\"showTab('schemas')\">📐 Schema 管理</button>\n" +
                    "            <button class=\"tab-btn\" onclick=\"showTab('status')\">📊 系统状态</button>\n" +
                    "        </div>\n" +
                    "\n" +
                    "        <div id=\"send\" class=\"tab-content active\">\n" +
                    "            <h2>消息发送</h2>\n" +
                    "            <div class=\"grid\">\n" +
                    "                <div class=\"form-group\">\n" +
                    "                    <label>MQ 类型</label>\n" +
                    "                    <select id=\"send-mqType\">\n" +
                    "                        <option value=\"KAFKA\">Kafka</option>\n" +
                    "                        <option value=\"RABBITMQ\">RabbitMQ</option>\n" +
                    "                        <option value=\"ROCKETMQ\">RocketMQ</option>\n" +
                    "                    </select>\n" +
                    "                </div>\n" +
                    "                <div class=\"form-group\">\n" +
                    "                    <label>消息格式</label>\n" +
                    "                    <select id=\"send-format\">\n" +
                    "                        <option value=\"JSON\">JSON</option>\n" +
                    "                        <option value=\"XML\">XML</option>\n" +
                    "                        <option value=\"PLAINTEXT\">PlainText</option>\n" +
                    "                        <option value=\"AVRO\">Avro</option>\n" +
                    "                        <option value=\"PROTOBUF\">Protobuf</option>\n" +
                    "                    </select>\n" +
                    "                </div>\n" +
                    "            </div>\n" +
                    "            <div class=\"form-group\">\n" +
                    "                <label>主题 (Topic)</label>\n" +
                    "                <input type=\"text\" id=\"send-topic\" placeholder=\"例如: order.created\">\n" +
                    "            </div>\n" +
                    "            <div class=\"form-group\">\n" +
                    "                <label>消息内容</label>\n" +
                    "                <textarea id=\"send-content\" placeholder='{\"orderId\":\"ORD001\",\"userId\":\"USR001\"}'></textarea>\n" +
                    "            </div>\n" +
                    "            <div class=\"grid\">\n" +
                    "                <div class=\"form-group\">\n" +
                    "                    <label>延迟等级 (1-12)</label>\n" +
                    "                    <input type=\"number\" id=\"send-delayLevel\" min=\"1\" max=\"12\" placeholder=\"可选\">\n" +
                    "                </div>\n" +
                    "                <div class=\"form-group\">\n" +
                    "                    <label>自定义延迟 (毫秒)</label>\n" +
                    "                    <input type=\"number\" id=\"send-delayMs\" placeholder=\"可选\">\n" +
                    "                </div>\n" +
                    "            </div>\n" +
                    "            <button class=\"btn btn-success\" onclick=\"sendMessage()\">🚀 发送消息</button>\n" +
                    "            <div id=\"send-result\" class=\"result\" style=\"display:none;\"></div>\n" +
                    "        </div>\n" +
                    "\n" +
                    "        <div id=\"batch\" class=\"tab-content\">\n" +
                    "            <h2>批量发送</h2>\n" +
                    "            <div class=\"form-group\">\n" +
                    "                <label>主题 (Topic)</label>\n" +
                    "                <input type=\"text\" id=\"batch-topic\" placeholder=\"例如: test.topic\">\n" +
                    "            </div>\n" +
                    "            <div class=\"form-group\">\n" +
                    "                <label>消息列表 (每行一条JSON)</label>\n" +
                    "                <textarea id=\"batch-contents\" placeholder='{\"id\":1}\\n{\"id\":2}\\n{\"id\":3}'></textarea>\n" +
                    "            </div>\n" +
                    "            <button class=\"btn btn-success\" onclick=\"sendBatch()\">📦 批量发送</button>\n" +
                    "            <div id=\"batch-result\" class=\"result\" style=\"display:none;\"></div>\n" +
                    "        </div>\n" +
                    "\n" +
                    "        <div id=\"templates\" class=\"tab-content\">\n" +
                    "            <h2>模板管理</h2>\n" +
                    "            <div class=\"grid\">\n" +
                    "                <div class=\"card\">\n" +
                    "                    <h3>📥 导入模板</h3>\n" +
                    "                    <div class=\"form-group\">\n" +
                    "                        <label>模板 JSON</label>\n" +
                    "                        <textarea id=\"template-import\" placeholder='粘贴模板JSON...'></textarea>\n" +
                    "                    </div>\n" +
                    "                    <button class=\"btn\" onclick=\"importTemplate()\">导入模板</button>\n" +
                    "                </div>\n" +
                    "                <div class=\"card\">\n" +
                    "                    <h3>📤 导出模板</h3>\n" +
                    "                    <div class=\"form-group\">\n" +
                    "                        <label>模板名称</label>\n" +
                    "                        <input type=\"text\" id=\"template-export-name\" placeholder=\"订单创建\">\n" +
                    "                    </div>\n" +
                    "                    <button class=\"btn\" onclick=\"exportTemplate()\">导出模板</button>\n" +
                    "                </div>\n" +
                    "            </div>\n" +
                    "            <h3 style=\"margin-top:20px;\">📋 模板列表</h3>\n" +
                    "            <div id=\"template-list\"></div>\n" +
                    "        </div>\n" +
                    "\n" +
                    "        <div id=\"schemas\" class=\"tab-content\">\n" +
                    "            <h2>Schema 管理</h2>\n" +
                    "            <div class=\"form-group\">\n" +
                    "                <label>JSON 内容 (用于推断 Avro Schema)</label>\n" +
                    "                <textarea id=\"schema-json\" placeholder='{\"id\":1,\"name\":\"test\"}'></textarea>\n" +
                    "            </div>\n" +
                    "            <div class=\"form-group\">\n" +
                    "                <label>Schema 名称</label>\n" +
                    "                <input type=\"text\" id=\"schema-name\" value=\"MySchema\">\n" +
                    "            </div>\n" +
                    "            <button class=\"btn\" onclick=\"inferSchema()\">🔍 推断 Schema</button>\n" +
                    "            <div id=\"schema-result\" class=\"result\" style=\"display:none;\"></div>\n" +
                    "            <h3 style=\"margin-top:20px;\">已注册 Schema</h3>\n" +
                    "            <div id=\"schema-list\"></div>\n" +
                    "        </div>\n" +
                    "\n" +
                    "        <div id=\"status\" class=\"tab-content\">\n" +
                    "            <h2>系统状态</h2>\n" +
                    "            <div id=\"status-content\"></div>\n" +
                    "        </div>\n" +
                    "    </div>\n" +
                    "\n" +
                    "    <script>\n" +
                    "        function showTab(tabName) {\n" +
                    "            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));\n" +
                    "            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));\n" +
                    "            document.getElementById(tabName).classList.add('active');\n" +
                    "            event.target.classList.add('active');\n" +
                    "            if (tabName === 'templates') loadTemplates();\n" +
                    "            if (tabName === 'schemas') loadSchemas();\n" +
                    "            if (tabName === 'status') loadStatus();\n" +
                    "        }\n" +
                    "\n" +
                    "        async function apiCall(url, method, data) {\n" +
                    "            const options = { method, headers: { 'Content-Type': 'application/json' } };\n" +
                    "            if (data) options.body = JSON.stringify(data);\n" +
                    "            const res = await fetch(url, options);\n" +
                    "            return await res.json();\n" +
                    "        }\n" +
                    "\n" +
                    "        async function sendMessage() {\n" +
                    "            const data = {\n" +
                    "                mqType: document.getElementById('send-mqType').value,\n" +
                    "                topic: document.getElementById('send-topic').value,\n" +
                    "                format: document.getElementById('send-format').value,\n" +
                    "                content: document.getElementById('send-content').value\n" +
                    "            };\n" +
                    "            const delayLevel = document.getElementById('send-delayLevel').value;\n" +
                    "            const delayMs = document.getElementById('send-delayMs').value;\n" +
                    "            if (delayLevel) data.delayLevel = parseInt(delayLevel);\n" +
                    "            if (delayMs) data.delayMs = parseInt(delayMs);\n" +
                    "\n" +
                    "            const result = await apiCall('/api/send', 'POST', data);\n" +
                    "            showResult('send-result', result);\n" +
                    "        }\n" +
                    "\n" +
                    "        async function sendBatch() {\n" +
                    "            const contentText = document.getElementById('batch-contents').value;\n" +
                    "            const contents = contentText.split('\\n').filter(l => l.trim());\n" +
                    "            const data = {\n" +
                    "                topic: document.getElementById('batch-topic').value,\n" +
                    "                contents: contents\n" +
                    "            };\n" +
                    "            const result = await apiCall('/api/send/batch', 'POST', data);\n" +
                    "            showResult('batch-result', result);\n" +
                    "        }\n" +
                    "\n" +
                    "        async function loadTemplates() {\n" +
                    "            const result = await apiCall('/api/templates', 'GET');\n" +
                    "            const html = result.data.map(t => `\n" +
                    "                <div class=\"card\" style=\"margin-bottom:10px;\">\n" +
                    "                    <h4>${t.name}</h4>\n" +
                    "                    <p>分类: ${t.category} | 格式: ${t.format}</p>\n" +
                    "                    <p>${t.description}</p>\n" +
                    "                    <button class=\"btn\" onclick=\"useTemplate('${t.name}')\">使用模板</button>\n" +
                    "                </div>\n" +
                    "            `).join('');\n" +
                    "            document.getElementById('template-list').innerHTML = html;\n" +
                    "        }\n" +
                    "\n" +
                    "        function useTemplate(name) {\n" +
                    "            showTab('send');\n" +
                    "            document.getElementById('send-topic').value = name;\n" +
                    "            alert('已选择模板: ' + name);\n" +
                    "        }\n" +
                    "\n" +
                    "        async function importTemplate() {\n" +
                    "            const content = document.getElementById('template-import').value;\n" +
                    "            const result = await apiCall('/api/templates/import', 'POST', { content });\n" +
                    "            showResult('template-list', result);\n" +
                    "            loadTemplates();\n" +
                    "        }\n" +
                    "\n" +
                    "        async function exportTemplate() {\n" +
                    "            const name = document.getElementById('template-export-name').value;\n" +
                    "            const result = await apiCall('/api/templates/export?name=' + encodeURIComponent(name), 'GET');\n" +
                    "            document.getElementById('template-import').value = JSON.stringify(result.data, null, 2);\n" +
                    "            showResult('template-list', { message: '模板已导出到上方文本框', code: 200 });\n" +
                    "        }\n" +
                    "\n" +
                    "        async function inferSchema() {\n" +
                    "            const data = {\n" +
                    "                jsonContent: document.getElementById('schema-json').value,\n" +
                    "                schemaName: document.getElementById('schema-name').value\n" +
                    "            };\n" +
                    "            const result = await apiCall('/api/schemas/infer', 'POST', data);\n" +
                    "            showResult('schema-result', result);\n" +
                    "        }\n" +
                    "\n" +
                    "        async function loadSchemas() {\n" +
                    "            const result = await apiCall('/api/schemas', 'GET');\n" +
                    "            const html = `<h4>Avro Schemas (${result.data.avro.length})</h4>` +\n" +
                    "                result.data.avro.map(s => `<p>${s.name} (v${s.version})</p>`).join('') +\n" +
                    "                `<h4>Protobuf Schemas (${result.data.protobuf.length})</h4>` +\n" +
                    "                result.data.protobuf.map(s => `<p>${s.name} (${s.messageType})</p>`).join('');\n" +
                    "            document.getElementById('schema-list').innerHTML = html;\n" +
                    "        }\n" +
                    "\n" +
                    "        async function loadStatus() {\n" +
                    "            const result = await apiCall('/api/status', 'GET');\n" +
                    "            const data = result.data;\n" +
                    "            document.getElementById('status-content').innerHTML = `\n" +
                    "                <div class=\"grid\">\n" +
                    "                    <div class=\"card\">\n" +
                    "                        <h3>运行状态</h3>\n" +
                    "                        <p>状态: ${data.status}</p>\n" +
                    "                        <p>端口: ${data.port}</p>\n" +
                    "                        <p>MQ类型: ${data.defaultMqType}</p>\n" +
                    "                        <p>启动时间: ${data.startTime}</p>\n" +
                    "                    </div>\n" +
                    "                    <div class=\"card\">\n" +
                    "                        <h3>资源统计</h3>\n" +
                    "                        <p>模板数量: ${data.templateCount}</p>\n" +
                    "                        <p>Avro Schema: ${data.avroSchemaCount}</p>\n" +
                    "                        <p>Protobuf Schema: ${data.protobufSchemaCount}</p>\n" +
                    "                        <p>活跃连接: ${data.activeSenders}</p>\n" +
                    "                    </div>\n" +
                    "                </div>\n" +
                    "            `;\n" +
                    "        }\n" +
                    "\n" +
                    "        function showResult(elementId, result) {\n" +
                    "            const el = document.getElementById(elementId);\n" +
                    "            el.style.display = 'block';\n" +
                    "            el.className = 'result ' + (result.code === 200 ? 'success' : 'error');\n" +
                    "            el.innerHTML = `<h4>${result.message}</h4><pre>${JSON.stringify(result.data || result, null, 2)}</pre>`;\n" +
                    "        }\n" +
                    "    </script>\n" +
                    "</body>\n" +
                    "</html>";
        }

        private MQConfig buildConfig(MQType mqType, Map<String, Object> request) {
            MQConfig config;
            if (mqType == MQType.KAFKA) {
                config = MQConfig.kafkaDefault();
                String bootstrapServers = (String) request.get("bootstrapServers");
                if (bootstrapServers != null) {
                    config.setBootstrapServers(bootstrapServers);
                }
            } else {
                config = MQConfig.rabbitMqDefault();
                String host = (String) request.get("host");
                Integer port = (Integer) request.get("port");
                String username = (String) request.get("username");
                String password = (String) request.get("password");
                if (host != null) config.setHost(host);
                if (port != null) config.setPort(port);
                if (username != null) config.setUsername(username);
                if (password != null) config.setPassword(password);
            }
            return config;
        }

        private MessageSender getOrCreateSender(MQConfig config) throws Exception {
            String key = config.getType() + ":" +
                    (config.getType() == MQType.KAFKA ? config.getBootstrapServers() : config.getHost() + ":" + config.getPort());

            MessageSender sender = senderCache.get(key);
            if (sender == null || !sender.isConnected()) {
                sender = MessageSenderFactory.createSender(config);
                sender.init(config);
                sender.connect();
                senderCache.put(key, sender);
            }
            return sender;
        }

        private Map<String, String> parseQueryParams(String uri) {
            Map<String, String> params = new HashMap<>();
            if (uri.contains("?")) {
                QueryStringDecoder decoder = new QueryStringDecoder(uri);
                decoder.parameters().forEach((k, v) -> params.put(k, v.isEmpty() ? "" : v.get(0)));
            }
            return params;
        }

        private String parseBody(FullHttpRequest req) {
            ByteBuf content = req.content();
            if (content.isReadable()) {
                return content.toString(StandardCharsets.UTF_8);
            }
            return "";
        }

        private void sendResponse(ChannelHandlerContext ctx, ApiResponse<?> response, HttpResponseStatus status) throws Exception {
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response);
            ByteBuf content = Unpooled.copiedBuffer(json, StandardCharsets.UTF_8);

            FullHttpResponse httpResponse = new DefaultFullHttpResponse(
                    HttpVersion.HTTP_1_1, status, content);

            httpResponse.headers().set(HttpHeaderNames.CONTENT_TYPE, "application/json; charset=UTF-8");
            httpResponse.headers().set(HttpHeaderNames.CONTENT_LENGTH, content.readableBytes());
            httpResponse.headers().set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_ORIGIN, "*");
            httpResponse.headers().set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_METHODS, "GET, POST, PUT, DELETE, OPTIONS");
            httpResponse.headers().set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type");

            ctx.writeAndFlush(httpResponse);
        }

        @Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
            logger.error("Exception in HTTP handler: {}", cause.getMessage(), cause);
            ctx.close();
        }
    }
}
