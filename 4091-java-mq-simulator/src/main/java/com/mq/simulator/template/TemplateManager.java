package com.mq.simulator.template;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.core.MQType;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.MessageTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TemplateManager {
    private static final Logger logger = LoggerFactory.getLogger(TemplateManager.class);
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\$\\{([^}]+)\\}");

    private final Map<String, MessageTemplate> templates;
    private final ObjectMapper objectMapper;
    private final String templatesDir;

    public TemplateManager() {
        this("templates");
    }

    public TemplateManager(String templatesDir) {
        this.templates = new ConcurrentHashMap<>();
        this.templatesDir = templatesDir;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);

        File dir = new File(templatesDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        loadBuiltinTemplates();
        loadTemplatesFromDisk();
    }

    private void loadBuiltinTemplates() {
        addTemplate(createOrderCreatedTemplate());
        addTemplate(createUserLoginTemplate());
        addTemplate(createPaymentCallbackTemplate());
    }

    private MessageTemplate createOrderCreatedTemplate() {
        MessageTemplate template = new MessageTemplate();
        template.setName("订单创建");
        template.setCategory("order");
        template.setDescription("订单创建事件消息模板");
        template.setMqType(MQType.KAFKA);
        template.setFormat(MessageFormat.JSON);
        template.setDefaultTopic("order.created");
        template.setContent("{\n" +
                "  \"orderId\": \"${orderId}\",\n" +
                "  \"userId\": \"${userId}\",\n" +
                "  \"productId\": \"${productId}\",\n" +
                "  \"quantity\": ${quantity},\n" +
                "  \"totalAmount\": ${totalAmount},\n" +
                "  \"status\": \"CREATED\",\n" +
                "  \"createdAt\": \"${timestamp}\",\n" +
                "  \"shippingAddress\": {\n" +
                "    \"name\": \"${shippingName}\",\n" +
                "    \"phone\": \"${shippingPhone}\",\n" +
                "    \"address\": \"${shippingAddress}\"\n" +
                "  }\n" +
                "}");
        template.addPlaceholder("orderId", "订单ID");
        template.addPlaceholder("userId", "用户ID");
        template.addPlaceholder("productId", "商品ID");
        template.addPlaceholder("quantity", "购买数量");
        template.addPlaceholder("totalAmount", "订单总金额");
        template.addPlaceholder("timestamp", "创建时间戳");
        template.addPlaceholder("shippingName", "收货人姓名");
        template.addPlaceholder("shippingPhone", "收货人电话");
        template.addPlaceholder("shippingAddress", "收货地址");
        template.addSampleValue("orderId", "ORD" + System.currentTimeMillis());
        template.addSampleValue("userId", "USR10001");
        template.addSampleValue("productId", "PRD2001");
        template.addSampleValue("quantity", "2");
        template.addSampleValue("totalAmount", "299.00");
        template.addSampleValue("shippingName", "张三");
        template.addSampleValue("shippingPhone", "13800138000");
        template.addSampleValue("shippingAddress", "北京市朝阳区xxx街道");
        return template;
    }

    private MessageTemplate createUserLoginTemplate() {
        MessageTemplate template = new MessageTemplate();
        template.setName("用户登录");
        template.setCategory("user");
        template.setDescription("用户登录事件消息模板");
        template.setMqType(MQType.KAFKA);
        template.setFormat(MessageFormat.JSON);
        template.setDefaultTopic("user.login");
        template.setContent("{\n" +
                "  \"userId\": \"${userId}\",\n" +
                "  \"username\": \"${username}\",\n" +
                "  \"loginType\": \"${loginType}\",\n" +
                "  \"ipAddress\": \"${ipAddress}\",\n" +
                "  \"userAgent\": \"${userAgent}\",\n" +
                "  \"location\": \"${location}\",\n" +
                "  \"loginAt\": \"${timestamp}\",\n" +
                "  \"success\": ${success}\n" +
                "}");
        template.addPlaceholder("userId", "用户ID");
        template.addPlaceholder("username", "用户名");
        template.addPlaceholder("loginType", "登录类型：PASSWORD/WECHAT/SMS");
        template.addPlaceholder("ipAddress", "登录IP地址");
        template.addPlaceholder("userAgent", "浏览器UA");
        template.addPlaceholder("location", "登录地点");
        template.addPlaceholder("timestamp", "登录时间");
        template.addPlaceholder("success", "是否登录成功");
        template.addSampleValue("userId", "USR10001");
        template.addSampleValue("username", "zhangsan");
        template.addSampleValue("loginType", "PASSWORD");
        template.addSampleValue("ipAddress", "192.168.1.100");
        template.addSampleValue("userAgent", "Chrome 120.0");
        template.addSampleValue("location", "北京市");
        template.addSampleValue("success", "true");
        return template;
    }

    private MessageTemplate createPaymentCallbackTemplate() {
        MessageTemplate template = new MessageTemplate();
        template.setName("支付回调");
        template.setCategory("payment");
        template.setDescription("支付成功回调消息模板");
        template.setMqType(MQType.RABBITMQ);
        template.setFormat(MessageFormat.JSON);
        template.setDefaultExchange("payment.exchange");
        template.setDefaultRoutingKey("payment.success");
        template.setContent("{\n" +
                "  \"paymentId\": \"${paymentId}\",\n" +
                "  \"orderId\": \"${orderId}\",\n" +
                "  \"userId\": \"${userId}\",\n" +
                "  \"amount\": ${amount},\n" +
                "  \"currency\": \"${currency}\",\n" +
                "  \"paymentMethod\": \"${paymentMethod}\",\n" +
                "  \"transactionId\": \"${transactionId}\",\n" +
                "  \"status\": \"${status}\",\n" +
                "  \"paidAt\": \"${timestamp}\"\n" +
                "}");
        template.addPlaceholder("paymentId", "支付ID");
        template.addPlaceholder("orderId", "订单ID");
        template.addPlaceholder("userId", "用户ID");
        template.addPlaceholder("amount", "支付金额");
        template.addPlaceholder("currency", "币种");
        template.addPlaceholder("paymentMethod", "支付方式：ALIPAY/WECHAT/CARD");
        template.addPlaceholder("transactionId", "第三方交易号");
        template.addPlaceholder("status", "支付状态");
        template.addPlaceholder("timestamp", "支付时间");
        template.addSampleValue("paymentId", "PAY" + System.currentTimeMillis());
        template.addSampleValue("orderId", "ORD202401010001");
        template.addSampleValue("userId", "USR10001");
        template.addSampleValue("amount", "299.00");
        template.addSampleValue("currency", "CNY");
        template.addSampleValue("paymentMethod", "ALIPAY");
        template.addSampleValue("transactionId", "202401011234567890");
        template.addSampleValue("status", "SUCCESS");
        return template;
    }

    private void loadTemplatesFromDisk() {
        try {
            Path dir = Paths.get(templatesDir);
            if (!Files.exists(dir)) {
                return;
            }

            Files.list(dir)
                    .filter(p -> p.toString().endsWith(".json"))
                    .forEach(p -> {
                        try {
                            MessageTemplate template = objectMapper.readValue(p.toFile(), MessageTemplate.class);
                            templates.put(template.getId(), template);
                            logger.info("Loaded template: {} from {}", template.getName(), p);
                        } catch (IOException e) {
                            logger.error("Failed to load template from {}: {}", p, e.getMessage());
                        }
                    });
        } catch (IOException e) {
            logger.error("Failed to scan templates directory: {}", e.getMessage());
        }
    }

    public MessageTemplate addTemplate(MessageTemplate template) {
        if (template.getId() == null) {
            template.setId(UUID.randomUUID().toString());
        }
        if (template.getCreatedAt() == null) {
            template.setCreatedAt(LocalDateTime.now());
        }
        template.setUpdatedAt(LocalDateTime.now());
        templates.put(template.getId(), template);
        saveTemplateToDisk(template);
        logger.info("Template added: {} ({})", template.getName(), template.getId());
        return template;
    }

    public MessageTemplate updateTemplate(String id, MessageTemplate template) {
        if (!templates.containsKey(id)) {
            throw new IllegalArgumentException("Template not found: " + id);
        }
        template.setId(id);
        template.setUpdatedAt(LocalDateTime.now());
        templates.put(id, template);
        saveTemplateToDisk(template);
        logger.info("Template updated: {} ({})", template.getName(), id);
        return template;
    }

    public void deleteTemplate(String id) {
        MessageTemplate template = templates.remove(id);
        if (template != null) {
            Path path = Paths.get(templatesDir, id + ".json");
            try {
                Files.deleteIfExists(path);
            } catch (IOException e) {
                logger.warn("Failed to delete template file: {}", e.getMessage());
            }
            logger.info("Template deleted: {} ({})", template.getName(), id);
        }
    }

    public MessageTemplate getTemplate(String id) {
        return templates.get(id);
    }

    public MessageTemplate getTemplateByName(String name) {
        return templates.values().stream()
                .filter(t -> t.getName().equals(name))
                .findFirst()
                .orElse(null);
    }

    public List<MessageTemplate> listTemplates() {
        return new ArrayList<>(templates.values());
    }

    public List<MessageTemplate> listTemplatesByCategory(String category) {
        List<MessageTemplate> result = new ArrayList<>();
        for (MessageTemplate template : templates.values()) {
            if (category.equals(template.getCategory())) {
                result.add(template);
            }
        }
        return result;
    }

    private void saveTemplateToDisk(MessageTemplate template) {
        try {
            Path path = Paths.get(templatesDir, template.getId() + ".json");
            objectMapper.writeValue(path.toFile(), template);
        } catch (IOException e) {
            logger.error("Failed to save template to disk: {}", e.getMessage());
        }
    }

    public void exportTemplate(String id, String exportPath) throws IOException {
        MessageTemplate template = getTemplate(id);
        if (template == null) {
            throw new IllegalArgumentException("Template not found: " + id);
        }
        objectMapper.writeValue(new File(exportPath), template);
        logger.info("Template exported to: {}", exportPath);
    }

    public MessageTemplate importTemplate(String importPath) throws IOException {
        MessageTemplate template = objectMapper.readValue(new File(importPath), MessageTemplate.class);
        if (templates.containsKey(template.getId())) {
            template.setId(UUID.randomUUID().toString());
        }
        return addTemplate(template);
    }

    public Message applyTemplate(MessageTemplate template) {
        return applyTemplate(template, Collections.emptyMap());
    }

    public Message applyTemplate(MessageTemplate template, Map<String, String> customValues) {
        Map<String, String> values = new HashMap<>(template.getSampleValues());
        if (customValues != null) {
            values.putAll(customValues);
        }

        String content = replacePlaceholders(template.getContent(), values);

        Message message = template.toMessage();
        message.setContent(content);

        return message;
    }

    public String replacePlaceholders(String content, Map<String, String> values) {
        if (content == null) {
            return null;
        }

        Matcher matcher = PLACEHOLDER_PATTERN.matcher(content);
        StringBuffer result = new StringBuffer();

        while (matcher.find()) {
            String key = matcher.group(1);
            String value = values.get(key);
            if (value == null) {
                value = getDefaultValue(key);
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);

        return result.toString();
    }

    private String getDefaultValue(String key) {
        switch (key.toLowerCase()) {
            case "timestamp":
                return LocalDateTime.now().toString();
            case "orderid":
                return "ORD" + System.currentTimeMillis();
            case "userid":
                return "USR" + System.currentTimeMillis();
            case "uuid":
                return UUID.randomUUID().toString();
            case "now":
                return String.valueOf(System.currentTimeMillis());
            default:
                return "";
        }
    }

    public List<String> extractPlaceholders(String content) {
        List<String> placeholders = new ArrayList<>();
        if (content == null) {
            return placeholders;
        }

        Matcher matcher = PLACEHOLDER_PATTERN.matcher(content);
        while (matcher.find()) {
            String placeholder = matcher.group(1);
            if (!placeholders.contains(placeholder)) {
                placeholders.add(placeholder);
            }
        }
        return placeholders;
    }
}
