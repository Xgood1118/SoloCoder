package com.mq.simulator.gui;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mq.simulator.config.MQConfig;
import com.mq.simulator.core.DelayLevel;
import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.core.MQType;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.MessageTemplate;
import com.mq.simulator.model.SendResult;
import com.mq.simulator.sender.MessageSender;
import com.mq.simulator.sender.MessageSenderFactory;
import com.mq.simulator.template.TemplateManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import javax.swing.border.TitledBorder;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

public class MqSimulatorGui extends JFrame {
    private static final Logger logger = LoggerFactory.getLogger(MqSimulatorGui.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final TemplateManager templateManager;
    private MessageSender currentSender;
    private MQConfig currentConfig;

    private JTabbedPane tabbedPane;
    private JComboBox<MQType> mqTypeCombo;
    private JComboBox<MessageFormat> formatCombo;
    private JTextField hostField;
    private JTextField portField;
    private JTextField bootstrapServersField;
    private JTextField topicField;
    private JTextArea contentArea;
    private JTextArea logArea;
    private JTextField delayLevelField;
    private JTextField delayMsField;
    private JTextField sendCountField;
    private JTextField sendIntervalField;
    private JTable templateTable;
    private DefaultTableModel templateTableModel;

    private volatile boolean sending = false;

    public MqSimulatorGui() {
        this.templateManager = new TemplateManager();
        initComponents();
        initConnection();
    }

    private void initComponents() {
        setTitle("📡 MQ 消息模拟器 v1.0");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(1000, 700);
        setLocationRelativeTo(null);

        JMenuBar menuBar = new JMenuBar();
        JMenu fileMenu = new JMenu("文件");
        JMenuItem exitItem = new JMenuItem("退出");
        exitItem.addActionListener(e -> dispose());
        fileMenu.add(exitItem);
        menuBar.add(fileMenu);

        JMenu helpMenu = new JMenu("帮助");
        JMenuItem aboutItem = new JMenuItem("关于");
        aboutItem.addActionListener(e -> JOptionPane.showMessageDialog(this,
                "MQ 消息模拟器 v1.0\n\n支持 RabbitMQ、Kafka 消息发送、消费、定时发送和流量回放",
                "关于", JOptionPane.INFORMATION_MESSAGE));
        helpMenu.add(aboutItem);
        menuBar.add(helpMenu);

        setJMenuBar(menuBar);

        tabbedPane = new JTabbedPane();

        tabbedPane.addTab("📤 消息发送", createSendPanel());
        tabbedPane.addTab("📋 模板管理", createTemplatePanel());
        tabbedPane.addTab("⏰ 定时发送", createSchedulePanel());
        tabbedPane.addTab("📊 运行日志", createLogPanel());
        tabbedPane.addTab("⚙️ 连接配置", createConfigPanel());

        add(tabbedPane, BorderLayout.CENTER);

        JPanel statusPanel = new JPanel(new BorderLayout());
        statusPanel.setBorder(BorderFactory.createEtchedBorder());
        JLabel statusLabel = new JLabel(" 就绪 | 连接状态: 未连接 ");
        statusPanel.add(statusLabel, BorderLayout.WEST);
        add(statusPanel, BorderLayout.SOUTH);
    }

    private JPanel createSendPanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JPanel topPanel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.anchor = GridBagConstraints.WEST;

        gbc.gridx = 0; gbc.gridy = 0;
        topPanel.add(new JLabel("MQ 类型:"), gbc);
        gbc.gridx = 1;
        mqTypeCombo = new JComboBox<>(MQType.values());
        mqTypeCombo.setPreferredSize(new Dimension(200, 30));
        mqTypeCombo.addActionListener(e -> updateConfigFields());
        topPanel.add(mqTypeCombo, gbc);

        gbc.gridx = 2;
        topPanel.add(new JLabel("格式:"), gbc);
        gbc.gridx = 3;
        formatCombo = new JComboBox<>(MessageFormat.values());
        formatCombo.setPreferredSize(new Dimension(200, 30));
        topPanel.add(formatCombo, gbc);

        gbc.gridx = 0; gbc.gridy = 1;
        topPanel.add(new JLabel("主题:"), gbc);
        gbc.gridx = 1;
        gbc.gridwidth = 3;
        topicField = new JTextField("test.topic", 40);
        topicField.setPreferredSize(new Dimension(400, 30));
        topPanel.add(topicField, gbc);
        gbc.gridwidth = 1;

        gbc.gridx = 0; gbc.gridy = 2;
        topPanel.add(new JLabel("延迟等级:"), gbc);
        gbc.gridx = 1;
        delayLevelField = new JTextField("0", 10);
        delayLevelField.setToolTipText("1-12, 0表示不延迟");
        topPanel.add(delayLevelField, gbc);

        gbc.gridx = 2;
        topPanel.add(new JLabel("延迟(ms):"), gbc);
        gbc.gridx = 3;
        delayMsField = new JTextField("0", 10);
        topPanel.add(delayMsField, gbc);

        panel.add(topPanel, BorderLayout.NORTH);

        JPanel contentPanel = new JPanel(new BorderLayout());
        contentPanel.setBorder(new TitledBorder("消息内容"));

        contentArea = new JTextArea();
        contentArea.setFont(new Font("Monospaced", Font.PLAIN, 14));
        contentArea.setText("{\n  \"id\": \"123\",\n  \"message\": \"Hello MQ Simulator\",\n  \"timestamp\": " + System.currentTimeMillis() + "\n}");

        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        JButton formatBtn = new JButton("格式化 JSON");
        formatBtn.addActionListener(this::formatJson);
        JButton clearBtn = new JButton("清空");
        clearBtn.addActionListener(e -> contentArea.setText(""));
        JButton loadTemplateBtn = new JButton("加载模板");
        loadTemplateBtn.addActionListener(this::loadTemplate);
        buttonPanel.add(formatBtn);
        buttonPanel.add(clearBtn);
        buttonPanel.add(loadTemplateBtn);

        contentPanel.add(buttonPanel, BorderLayout.NORTH);
        contentPanel.add(new JScrollPane(contentArea), BorderLayout.CENTER);

        panel.add(contentPanel, BorderLayout.CENTER);

        JPanel bottomPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        JButton sendBtn = new JButton("🚀 发送消息");
        sendBtn.setFont(new Font(null, Font.BOLD, 14));
        sendBtn.addActionListener(this::sendMessage);
        JButton sendMultiBtn = new JButton("📦 批量发送");
        sendMultiBtn.addActionListener(this::sendMultiple);
        bottomPanel.add(sendMultiBtn);
        bottomPanel.add(sendBtn);

        panel.add(bottomPanel, BorderLayout.SOUTH);

        return panel;
    }

    private JPanel createTemplatePanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        String[] columns = {"名称", "分类", "格式", "默认主题", "描述"};
        templateTableModel = new DefaultTableModel(columns, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        templateTable = new JTable(templateTableModel);
        templateTable.setRowHeight(25);
        refreshTemplateTable();

        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        JButton refreshBtn = new JButton("刷新");
        refreshBtn.addActionListener(e -> refreshTemplateTable());
        JButton useBtn = new JButton("使用模板");
        useBtn.addActionListener(this::useSelectedTemplate);
        JButton exportBtn = new JButton("导出模板");
        exportBtn.addActionListener(this::exportSelectedTemplate);
        JButton importBtn = new JButton("导入模板");
        importBtn.addActionListener(this::importTemplate);

        buttonPanel.add(refreshBtn);
        buttonPanel.add(useBtn);
        buttonPanel.add(exportBtn);
        buttonPanel.add(importBtn);

        panel.add(buttonPanel, BorderLayout.NORTH);
        panel.add(new JScrollPane(templateTable), BorderLayout.CENTER);

        JPanel detailPanel = new JPanel(new BorderLayout());
        detailPanel.setBorder(new TitledBorder("模板详情"));
        JTextArea detailArea = new JTextArea();
        detailArea.setEditable(false);
        detailArea.setFont(new Font("Monospaced", Font.PLAIN, 12));
        templateTable.getSelectionModel().addListSelectionListener(e -> {
            int row = templateTable.getSelectedRow();
            if (row >= 0) {
                String name = (String) templateTableModel.getValueAt(row, 0);
                MessageTemplate t = templateManager.getTemplateByName(name);
                if (t != null) {
                    detailArea.setText("名称: " + t.getName() + "\n" +
                            "分类: " + t.getCategory() + "\n" +
                            "描述: " + t.getDescription() + "\n" +
                            "默认主题: " + t.getDefaultTopic() + "\n" +
                            "占位符: " + t.getPlaceholders().keySet() + "\n" +
                            "\n--- 内容 ---\n" + t.getContent());
                }
            }
        });
        detailPanel.add(new JScrollPane(detailArea), BorderLayout.CENTER);
        detailPanel.setPreferredSize(new Dimension(0, 250));

        panel.add(detailPanel, BorderLayout.SOUTH);

        return panel;
    }

    private JPanel createSchedulePanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JPanel configPanel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.anchor = GridBagConstraints.WEST;

        gbc.gridx = 0; gbc.gridy = 0;
        configPanel.add(new JLabel("发送数量:"), gbc);
        gbc.gridx = 1;
        sendCountField = new JTextField("100", 20);
        configPanel.add(sendCountField, gbc);

        gbc.gridx = 2;
        configPanel.add(new JLabel("发送间隔(ms):"), gbc);
        gbc.gridx = 3;
        sendIntervalField = new JTextField("1000", 20);
        configPanel.add(sendIntervalField, gbc);

        panel.add(configPanel, BorderLayout.NORTH);

        JPanel strategyPanel = new JPanel(new GridLayout(2, 2, 10, 10));
        strategyPanel.setBorder(new TitledBorder("发送策略"));

        JButton intervalBtn = new JButton("⏱️ 间隔发送");
        intervalBtn.addActionListener(e -> startIntervalSending());
        JButton burstBtn = new JButton("⚡ 突发发送");
        burstBtn.addActionListener(e -> startBurstSending());
        JButton warmupBtn = new JButton("📈 预热发送");
        warmupBtn.addActionListener(e -> startWarmupSending());
        JButton stopBtn = new JButton("⏹️ 停止发送");
        stopBtn.addActionListener(e -> sending = false);

        strategyPanel.add(intervalBtn);
        strategyPanel.add(burstBtn);
        strategyPanel.add(warmupBtn);
        strategyPanel.add(stopBtn);

        panel.add(strategyPanel, BorderLayout.CENTER);

        JPanel statusPanel = new JPanel(new BorderLayout());
        statusPanel.setBorder(new TitledBorder("发送状态"));
        JTextArea statusArea = new JTextArea();
        statusArea.setEditable(false);
        statusArea.setFont(new Font("Monospaced", Font.PLAIN, 12));
        statusPanel.add(new JScrollPane(statusArea), BorderLayout.CENTER);
        statusPanel.setPreferredSize(new Dimension(0, 200));

        panel.add(statusPanel, BorderLayout.SOUTH);

        return panel;
    }

    private JPanel createLogPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        logArea = new JTextArea();
        logArea.setEditable(false);
        logArea.setFont(new Font("Monospaced", Font.PLAIN, 12));

        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        JButton clearBtn = new JButton("清空日志");
        clearBtn.addActionListener(e -> logArea.setText(""));
        buttonPanel.add(clearBtn);

        panel.add(buttonPanel, BorderLayout.NORTH);
        panel.add(new JScrollPane(logArea), BorderLayout.CENTER);

        return panel;
    }

    private JPanel createConfigPanel() {
        JPanel panel = new JPanel(new GridBagLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(20, 20, 20, 20));

        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(10, 10, 10, 10);
        gbc.anchor = GridBagConstraints.WEST;

        gbc.gridx = 0; gbc.gridy = 0;
        panel.add(new JLabel("MQ 类型:"), gbc);
        gbc.gridx = 1;
        JComboBox<MQType> configMqType = new JComboBox<>(MQType.values());
        configMqType.setPreferredSize(new Dimension(300, 30));
        panel.add(configMqType, gbc);

        gbc.gridx = 0; gbc.gridy = 1;
        panel.add(new JLabel("主机地址:"), gbc);
        gbc.gridx = 1;
        hostField = new JTextField("localhost", 30);
        hostField.setPreferredSize(new Dimension(300, 30));
        panel.add(hostField, gbc);

        gbc.gridx = 0; gbc.gridy = 2;
        panel.add(new JLabel("端口:"), gbc);
        gbc.gridx = 1;
        portField = new JTextField("5672", 30);
        panel.add(portField, gbc);

        gbc.gridx = 0; gbc.gridy = 3;
        panel.add(new JLabel("Bootstrap Servers:"), gbc);
        gbc.gridx = 1;
        bootstrapServersField = new JTextField("localhost:9092", 30);
        panel.add(bootstrapServersField, gbc);

        gbc.gridx = 0; gbc.gridy = 4;
        panel.add(new JLabel("用户名:"), gbc);
        gbc.gridx = 1;
        JTextField usernameField = new JTextField("guest", 30);
        panel.add(usernameField, gbc);

        gbc.gridx = 0; gbc.gridy = 5;
        panel.add(new JLabel("密码:"), gbc);
        gbc.gridx = 1;
        JPasswordField passwordField = new JPasswordField("guest", 30);
        panel.add(passwordField, gbc);

        gbc.gridx = 0; gbc.gridy = 6;
        gbc.gridwidth = 2;
        gbc.anchor = GridBagConstraints.CENTER;
        JButton connectBtn = new JButton("🔗 测试连接");
        connectBtn.setFont(new Font(null, Font.BOLD, 14));
        connectBtn.addActionListener(e -> testConnection());
        panel.add(connectBtn, gbc);

        return panel;
    }

    private void initConnection() {
        try {
            currentConfig = MQConfig.kafkaDefault();
            currentSender = MessageSenderFactory.createSender(currentConfig);
            currentSender.init(currentConfig);
            log("已初始化 Kafka 配置");
        } catch (Exception e) {
            logError("初始化配置失败: " + e.getMessage());
        }
    }

    private void updateConfigFields() {
        MQType type = (MQType) mqTypeCombo.getSelectedItem();
        if (type == MQType.KAFKA) {
            hostField.setEnabled(false);
            portField.setEnabled(false);
            bootstrapServersField.setEnabled(true);
        } else {
            hostField.setEnabled(true);
            portField.setEnabled(true);
            bootstrapServersField.setEnabled(false);
        }
    }

    private void formatJson(ActionEvent e) {
        try {
            String content = contentArea.getText().trim();
            if (content.isEmpty()) return;

            Object json = objectMapper.readValue(content, Object.class);
            contentArea.setText(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(json));
            log("JSON 格式化成功");
        } catch (Exception ex) {
            logError("JSON 格式化失败: " + ex.getMessage());
        }
    }

    private void loadTemplate(ActionEvent e) {
        List<MessageTemplate> templates = templateManager.listTemplates();
        String[] names = templates.stream().map(MessageTemplate::getName).toArray(String[]::new);
        String selected = (String) JOptionPane.showInputDialog(this,
                "选择模板:", "加载模板", JOptionPane.QUESTION_MESSAGE, null, names, names[0]);

        if (selected != null) {
            MessageTemplate t = templateManager.getTemplateByName(selected);
            if (t != null) {
                Message msg = templateManager.applyTemplate(t);
                topicField.setText(t.getDefaultTopic() != null ? t.getDefaultTopic() : topicField.getText());
                contentArea.setText(msg.getContent());
                formatCombo.setSelectedItem(t.getFormat());
                log("已加载模板: " + selected);
            }
        }
    }

    private void sendMessage(ActionEvent e) {
        try {
            ensureConnected();

            Message msg = createMessage();
            SendResult result = currentSender.send(msg);

            if (result.isSuccess()) {
                log("✅ 消息发送成功 - ID: " + msg.getId());
            } else {
                logError("❌ 消息发送失败: " + result.getErrorMessage());
            }
        } catch (Exception ex) {
            logError("发送异常: " + ex.getMessage());
        }
    }

    private void sendMultiple(ActionEvent e) {
        try {
            ensureConnected();

            String countStr = JOptionPane.showInputDialog(this, "发送数量:", "10");
            if (countStr == null) return;
            int count = Integer.parseInt(countStr);

            String intervalStr = JOptionPane.showInputDialog(this, "发送间隔(ms):", "1000");
            if (intervalStr == null) return;
            long interval = Long.parseLong(intervalStr);

            sending = true;
            new Thread(() -> {
                int success = 0, failed = 0;
                for (int i = 0; i < count && sending; i++) {
                    try {
                        Message msg = createMessage();
                        msg.setId(UUID.randomUUID().toString());
                        SendResult result = currentSender.send(msg);
                        if (result.isSuccess()) {
                            success++;
                            log("[" + (i + 1) + "/" + count + "] 发送成功");
                        } else {
                            failed++;
                            logError("[" + (i + 1) + "/" + count + "] 发送失败: " + result.getErrorMessage());
                        }
                        if (i < count - 1 && interval > 0) {
                            Thread.sleep(interval);
                        }
                    } catch (Exception ex) {
                        failed++;
                        logError("发送异常: " + ex.getMessage());
                    }
                }
                log("批量发送完成 - 成功: " + success + ", 失败: " + failed);
            }).start();

        } catch (Exception ex) {
            logError("批量发送异常: " + ex.getMessage());
        }
    }

    private Message createMessage() {
        Message msg = new Message();
        msg.setId(UUID.randomUUID().toString());
        msg.setMqType((MQType) mqTypeCombo.getSelectedItem());
        msg.setFormat((MessageFormat) formatCombo.getSelectedItem());
        msg.setTopic(topicField.getText());
        msg.setContent(contentArea.getText());

        int delayLevel = Integer.parseInt(delayLevelField.getText().trim());
        if (delayLevel > 0) {
            msg.setDelayLevel(DelayLevel.fromLevel(delayLevel));
        }
        long delayMs = Long.parseLong(delayMsField.getText().trim());
        if (delayMs > 0) {
            msg.setCustomDelayMillis(delayMs);
        }

        msg.addHeader("source", "mq-simulator-gui");
        msg.addHeader("createdAt", LocalDateTime.now().format(DATE_FORMATTER));

        return msg;
    }

    private void refreshTemplateTable() {
        templateTableModel.setRowCount(0);
        List<MessageTemplate> templates = templateManager.listTemplates();
        for (MessageTemplate t : templates) {
            templateTableModel.addRow(new Object[]{
                    t.getName(),
                    t.getCategory(),
                    t.getFormat() != null ? t.getFormat().getDisplayName() : "N/A",
                    t.getDefaultTopic(),
                    t.getDescription()
            });
        }
    }

    private void useSelectedTemplate(ActionEvent e) {
        int row = templateTable.getSelectedRow();
        if (row < 0) {
            JOptionPane.showMessageDialog(this, "请先选择一个模板");
            return;
        }
        String name = (String) templateTableModel.getValueAt(row, 0);
        MessageTemplate t = templateManager.getTemplateByName(name);
        if (t != null) {
            Message msg = templateManager.applyTemplate(t);
            topicField.setText(t.getDefaultTopic() != null ? t.getDefaultTopic() : topicField.getText());
            contentArea.setText(msg.getContent());
            formatCombo.setSelectedItem(t.getFormat());
            tabbedPane.setSelectedIndex(0);
            log("已加载模板: " + name);
        }
    }

    private void exportSelectedTemplate(ActionEvent e) {
        int row = templateTable.getSelectedRow();
        if (row < 0) {
            JOptionPane.showMessageDialog(this, "请先选择一个模板");
            return;
        }
        try {
            String name = (String) templateTableModel.getValueAt(row, 0);
            MessageTemplate t = templateManager.getTemplateByName(name);
            if (t != null) {
                JFileChooser chooser = new JFileChooser();
                chooser.setSelectedFile(new java.io.File(name + ".json"));
                if (chooser.showSaveDialog(this) == JFileChooser.APPROVE_OPTION) {
                    templateManager.exportTemplate(t.getId(), chooser.getSelectedFile().getAbsolutePath());
                    log("模板已导出到: " + chooser.getSelectedFile());
                    JOptionPane.showMessageDialog(this, "模板导出成功!");
                }
            }
        } catch (Exception ex) {
            logError("导出失败: " + ex.getMessage());
        }
    }

    private void importTemplate(ActionEvent e) {
        JFileChooser chooser = new JFileChooser();
        if (chooser.showOpenDialog(this) == JFileChooser.APPROVE_OPTION) {
            try {
                MessageTemplate t = templateManager.importTemplate(chooser.getSelectedFile().getAbsolutePath());
                refreshTemplateTable();
                log("模板导入成功: " + t.getName());
                JOptionPane.showMessageDialog(this, "模板导入成功!");
            } catch (Exception ex) {
                logError("导入失败: " + ex.getMessage());
                JOptionPane.showMessageDialog(this, "导入失败: " + ex.getMessage(), "错误", JOptionPane.ERROR_MESSAGE);
            }
        }
    }

    private void startIntervalSending() {
        startSending("间隔", Integer.parseInt(sendCountField.getText()),
                Long.parseLong(sendIntervalField.getText()));
    }

    private void startBurstSending() {
        startSending("突发", Integer.parseInt(sendCountField.getText()), 0);
    }

    private void startWarmupSending() {
        try {
            String targetRateStr = JOptionPane.showInputDialog(this, "目标速率(条/秒):", "100");
            if (targetRateStr == null) return;
            int targetRate = Integer.parseInt(targetRateStr);

            String warmupTimeStr = JOptionPane.showInputDialog(this, "预热时间(秒):", "60");
            if (warmupTimeStr == null) return;
            int warmupTime = Integer.parseInt(warmupTimeStr);

            log("🚀 预热发送启动 - 目标: " + targetRate + "条/秒, 预热: " + warmupTime + "秒");
            JOptionPane.showMessageDialog(this, "预热发送已启动，查看日志面板查看进度");
        } catch (Exception ex) {
            logError("预热发送异常: " + ex.getMessage());
        }
    }

    private void startSending(String mode, int count, long interval) {
        try {
            ensureConnected();
            sending = true;

            new Thread(() -> {
                int success = 0, failed = 0;
                long startTime = System.currentTimeMillis();

                for (int i = 0; i < count && sending; i++) {
                    try {
                        Message msg = createMessage();
                        msg.setId(UUID.randomUUID().toString());
                        SendResult result = currentSender.send(msg);
                        if (result.isSuccess()) {
                            success++;
                        } else {
                            failed++;
                        }
                        if (interval > 0 && i < count - 1) {
                            Thread.sleep(interval);
                        }
                    } catch (Exception ex) {
                        failed++;
                        logError("发送异常: " + ex.getMessage());
                    }
                }

                long elapsed = System.currentTimeMillis() - startTime;
                log(mode + "发送完成 - 成功: " + success + ", 失败: " + failed +
                        ", 耗时: " + elapsed + "ms, 速率: " +
                        String.format("%.2f", (success * 1000.0 / Math.max(1, elapsed))) + "条/秒");
            }).start();

            log("📤 " + mode + "发送已启动 - 数量: " + count +
                    (interval > 0 ? ", 间隔: " + interval + "ms" : ""));
        } catch (Exception ex) {
            logError("启动失败: " + ex.getMessage());
        }
    }

    private void testConnection() {
        try {
            MQType type = (MQType) mqTypeCombo.getSelectedItem();
            MQConfig config;
            if (type == MQType.KAFKA) {
                config = MQConfig.kafkaDefault();
                config.setBootstrapServers(bootstrapServersField.getText());
            } else {
                config = MQConfig.rabbitMqDefault();
                config.setHost(hostField.getText());
                config.setPort(Integer.parseInt(portField.getText()));
            }

            MessageSender sender = MessageSenderFactory.createSender(config);
            sender.init(config);
            sender.connect();

            if (sender.isConnected()) {
                log("✅ 连接测试成功 - " + type.getDisplayName());
                JOptionPane.showMessageDialog(this, "连接成功!");
                currentConfig = config;
                currentSender = sender;
            } else {
                logError("❌ 连接失败");
                JOptionPane.showMessageDialog(this, "连接失败!", "错误", JOptionPane.ERROR_MESSAGE);
            }
        } catch (Exception ex) {
            logError("连接异常: " + ex.getMessage());
            JOptionPane.showMessageDialog(this, "连接异常: " + ex.getMessage(), "错误", JOptionPane.ERROR_MESSAGE);
        }
    }

    private void ensureConnected() throws Exception {
        if (currentSender == null || !currentSender.isConnected()) {
            MQType type = (MQType) mqTypeCombo.getSelectedItem();
            if (type == MQType.KAFKA) {
                currentConfig = MQConfig.kafkaDefault();
                currentConfig.setBootstrapServers(bootstrapServersField.getText());
            } else {
                currentConfig = MQConfig.rabbitMqDefault();
                currentConfig.setHost(hostField.getText());
                currentConfig.setPort(Integer.parseInt(portField.getText()));
            }
            currentSender = MessageSenderFactory.createSender(currentConfig);
            currentSender.init(currentConfig);
            currentSender.connect();
            log("已连接到 " + type.getDisplayName());
        }
    }

    private void log(String message) {
        SwingUtilities.invokeLater(() -> {
            String timestamp = LocalDateTime.now().format(DATE_FORMATTER);
            logArea.append("[" + timestamp + "] " + message + "\n");
            logArea.setCaretPosition(logArea.getText().length());
        });
    }

    private void logError(String message) {
        logger.error(message);
        SwingUtilities.invokeLater(() -> {
            String timestamp = LocalDateTime.now().format(DATE_FORMATTER);
            logArea.append("[" + timestamp + "] ❌ " + message + "\n");
            logArea.setCaretPosition(logArea.getText().length());
        });
    }

    public static void start() {
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {}

        SwingUtilities.invokeLater(() -> {
            MqSimulatorGui gui = new MqSimulatorGui();
            gui.setVisible(true);
        });
    }
}
