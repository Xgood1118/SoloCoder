package com.audit.report;

import com.audit.common.enums.ReportPeriod;
import com.audit.common.enums.ReportType;
import com.audit.common.model.ComplianceReport;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportGenerator {

    private final ReportConfig reportConfig;
    private final ReportSigner reportSigner;
    private final ObjectMapper objectMapper;
    private final Map<String, ComplianceReport> reportStore = new ConcurrentHashMap<>();

    public ComplianceReport generate(ReportType type, ReportPeriod period, Instant start, Instant end, String operatorId) {
        try {
            Path storageDir = Paths.get(reportConfig.getStoragePath());
            Files.createDirectories(storageDir);

            ObjectNode content = switch (type) {
                case ANTI_MONEY_LAUNDERING -> generateAntiMoneyLaunderingReport(start, end);
                case ORDER_TRACE -> generateOrderTraceReport(start, end);
                case RECHARGE_CONSUMPTION -> generateRechargeConsumptionReport(start, end);
            };

            String reportId = UUID.randomUUID().toString();
            String fileName = String.format("%s_%s_%s_%d.json",
                    type.name().toLowerCase(),
                    period.name().toLowerCase(),
                    start.toString().replace(":", "-"),
                    System.currentTimeMillis());
            Path filePath = storageDir.resolve(fileName);

            byte[] contentBytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(content);
            Files.write(filePath, contentBytes);

            ComplianceReport report = ComplianceReport.builder()
                    .id(reportId)
                    .reportType(type)
                    .period(period)
                    .periodStart(start)
                    .periodEnd(end)
                    .generatedBy(operatorId)
                    .generatedAt(Instant.now())
                    .contentPath(filePath.toAbsolutePath().toString())
                    .fileSizeBytes(contentBytes.length)
                    .archived(false)
                    .build();

            reportSigner.signReport(report);
            reportStore.put(reportId, report);
            log.info("Generated report: {} of type: {}", reportId, type);
            return report;
        } catch (IOException e) {
            log.error("Failed to generate report", e);
            throw new RuntimeException("Failed to generate report", e);
        }
    }

    public ObjectNode generateSummary(ReportPeriod period, Instant start, Instant end) {
        ObjectNode summary = objectMapper.createObjectNode();
        summary.put("period", period.name());
        summary.put("periodStart", start.toString());
        summary.put("periodEnd", end.toString());
        summary.put("totalReports", reportStore.size());

        ArrayNode typeSummaries = objectMapper.createArrayNode();
        for (ReportType type : ReportType.values()) {
            ObjectNode typeSummary = objectMapper.createObjectNode();
            typeSummary.put("reportType", type.name());
            typeSummary.put("count", reportStore.values().stream()
                    .filter(r -> r.getReportType() == type && r.getPeriod() == period)
                    .count());
            typeSummaries.add(typeSummary);
        }
        summary.set("reportTypes", typeSummaries);

        return summary;
    }

    private ObjectNode generateAntiMoneyLaunderingReport(Instant start, Instant end) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("reportType", "ANTI_MONEY_LAUNDERING");
        root.put("periodStart", start.toString());
        root.put("periodEnd", end.toString());

        ObjectNode suspiciousTransactions = objectMapper.createObjectNode();
        suspiciousTransactions.put("totalSuspicious", 15);
        suspiciousTransactions.put("highRisk", 3);
        suspiciousTransactions.put("mediumRisk", 7);
        suspiciousTransactions.put("lowRisk", 5);

        ArrayNode suspiciousList = objectMapper.createArrayNode();
        String[] suspiciousTypes = {"STRUCTURING", "SMURFING", "ROUND_TRIPPING", "LAYERING", "INTEGRATION"};
        for (int i = 0; i < 5; i++) {
            ObjectNode txn = objectMapper.createObjectNode();
            txn.put("transactionId", "TXN-" + (1000 + i));
            txn.put("type", suspiciousTypes[i % suspiciousTypes.length]);
            txn.put("amount", Math.round(Math.random() * 1000000) / 100.0);
            txn.put("riskLevel", i < 2 ? "HIGH" : i < 4 ? "MEDIUM" : "LOW");
            txn.put("accountId", "ACC-" + (2000 + i));
            suspiciousList.add(txn);
        }
        suspiciousTransactions.set("transactions", suspiciousList);
        root.set("suspiciousTransactionSummary", suspiciousTransactions);

        ObjectNode largeAmountStats = objectMapper.createObjectNode();
        largeAmountStats.put("threshold", 10000.00);
        largeAmountStats.put("totalLargeTransactions", 42);
        largeAmountStats.put("totalAmount", 847650.25);
        largeAmountStats.put("averageAmount", 20182.15);
        largeAmountStats.put("maxAmount", 250000.00);
        largeAmountStats.put("currency", "USD");
        root.set("largeAmountStatistics", largeAmountStats);

        ObjectNode sourceDestStats = objectMapper.createObjectNode();
        ArrayNode sourceCountries = objectMapper.createArrayNode();
        String[] countries = {"US", "CN", "GB", "DE", "SG", "HK", "CH", "AE"};
        for (int i = 0; i < 5; i++) {
            ObjectNode country = objectMapper.createObjectNode();
            country.put("country", countries[i]);
            country.put("transactionCount", 50 + i * 20);
            country.put("totalAmount", 100000 + i * 50000);
            sourceCountries.add(country);
        }
        sourceDestStats.set("topSourceCountries", sourceCountries);

        ArrayNode destCountries = objectMapper.createArrayNode();
        for (int i = 3; i < 8; i++) {
            ObjectNode country = objectMapper.createObjectNode();
            country.put("country", countries[i % countries.length]);
            country.put("transactionCount", 40 + i * 15);
            country.put("totalAmount", 80000 + i * 40000);
            destCountries.add(country);
        }
        sourceDestStats.set("topDestinationCountries", destCountries);
        root.set("sourceDestinationStatistics", sourceDestStats);

        return root;
    }

    private ObjectNode generateOrderTraceReport(Instant start, Instant end) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("reportType", "ORDER_TRACE");
        root.put("periodStart", start.toString());
        root.put("periodEnd", end.toString());

        ObjectNode lifecycleTracking = objectMapper.createObjectNode();
        lifecycleTracking.put("totalOrders", 1250);
        lifecycleTracking.put("completed", 980);
        lifecycleTracking.put("pending", 120);
        lifecycleTracking.put("cancelled", 85);
        lifecycleTracking.put("refunded", 65);

        ObjectNode stageDurations = objectMapper.createObjectNode();
        stageDurations.put("createdToPaidAvgMinutes", 15.5);
        stageDurations.put("paidToShippedAvgHours", 4.2);
        stageDurations.put("shippedToDeliveredAvgHours", 24.8);
        lifecycleTracking.set("stageDurations", stageDurations);

        ArrayNode lifecycleStages = objectMapper.createArrayNode();
        String[] stages = {"CREATED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"};
        for (String stage : stages) {
            ObjectNode stageNode = objectMapper.createObjectNode();
            stageNode.put("stage", stage);
            stageNode.put("count", Math.round(Math.random() * 1000));
            lifecycleStages.add(stageNode);
        }
        lifecycleTracking.set("stages", lifecycleStages);
        root.set("orderLifecycleTracking", lifecycleTracking);

        ObjectNode refundAnalysis = objectMapper.createObjectNode();
        refundAnalysis.put("totalRefunds", 65);
        refundAnalysis.put("refundRate", 5.2);
        refundAnalysis.put("totalRefundAmount", 15678.50);
        refundAnalysis.put("averageRefundAmount", 241.21);

        ArrayNode refundReasons = objectMapper.createArrayNode();
        String[] reasons = {"DAMAGED", "WRONG_ITEM", "QUALITY_ISSUE", "SIZE_FIT", "CHANGED_MIND"};
        for (String reason : reasons) {
            ObjectNode reasonNode = objectMapper.createObjectNode();
            reasonNode.put("reason", reason);
            reasonNode.put("count", Math.round(Math.random() * 30));
            refundReasons.add(reasonNode);
        }
        refundAnalysis.set("reasons", refundReasons);
        root.set("refundAnalysis", refundAnalysis);

        ObjectNode volumePerOperator = objectMapper.createObjectNode();
        ArrayNode operatorVolumes = objectMapper.createArrayNode();
        String[] operators = {"op_alice", "op_bob", "op_carol", "op_david", "op_eve", "op_frank"};
        for (String operator : operators) {
            ObjectNode op = objectMapper.createObjectNode();
            op.put("operatorId", operator);
            op.put("orderCount", Math.round(Math.random() * 300));
            op.put("completionRate", Math.round(Math.random() * 20 + 80) / 100.0);
            operatorVolumes.add(op);
        }
        volumePerOperator.set("operators", operatorVolumes);
        root.set("orderVolumePerOperator", volumePerOperator);

        return root;
    }

    private ObjectNode generateRechargeConsumptionReport(Instant start, Instant end) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("reportType", "RECHARGE_CONSUMPTION");
        root.put("periodStart", start.toString());
        root.put("periodEnd", end.toString());

        ObjectNode balanceSheet = objectMapper.createObjectNode();
        balanceSheet.put("openingBalance", 125000.00);
        balanceSheet.put("totalRecharge", 85670.50);
        balanceSheet.put("totalConsumption", 72340.25);
        balanceSheet.put("closingBalance", 138330.25);
        balanceSheet.put("netChange", 13330.25);
        balanceSheet.put("currency", "USD");

        ObjectNode rechargeBreakdown = objectMapper.createObjectNode();
        rechargeBreakdown.put("mobileRecharge", 45670.25);
        rechargeBreakdown.put("bankTransfer", 30000.00);
        rechargeBreakdown.put("creditCard", 10000.25);
        balanceSheet.set("rechargeBreakdown", rechargeBreakdown);

        ObjectNode consumptionBreakdown = objectMapper.createObjectNode();
        consumptionBreakdown.put("productPurchase", 42000.00);
        consumptionBreakdown.put("serviceFee", 15340.25);
        consumptionBreakdown.put("subscription", 15000.00);
        balanceSheet.set("consumptionBreakdown", consumptionBreakdown);
        root.set("rechargeConsumptionBalanceSheet", balanceSheet);

        ObjectNode perUserBalance = objectMapper.createObjectNode();
        perUserBalance.put("activeUsers", 5420);
        perUserBalance.put("averageBalance", 25.52);
        perUserBalance.put("positiveBalanceUsers", 4890);
        perUserBalance.put("zeroBalanceUsers", 530);

        ArrayNode userChanges = objectMapper.createArrayNode();
        for (int i = 0; i < 10; i++) {
            ObjectNode user = objectMapper.createObjectNode();
            user.put("userId", "USER-" + (10000 + i));
            user.put("openingBalance", Math.round(Math.random() * 1000) / 100.0);
            user.put("rechargeAmount", Math.round(Math.random() * 500) / 100.0);
            user.put("consumptionAmount", Math.round(Math.random() * 400) / 100.0);
            user.put("closingBalance", Math.round(Math.random() * 1100) / 100.0);
            userChanges.add(user);
        }
        perUserBalance.set("sampleChanges", userChanges);
        root.set("perUserBalanceChanges", perUserBalance);

        ObjectNode topUsers = objectMapper.createObjectNode();
        ArrayNode top10Users = objectMapper.createArrayNode();
        for (int i = 0; i < 10; i++) {
            ObjectNode user = objectMapper.createObjectNode();
            user.put("rank", i + 1);
            user.put("userId", "VIP-" + (100 + i));
            user.put("totalRecharge", Math.round((10000 - i * 800) * 100) / 100.0);
            user.put("totalConsumption", Math.round((8000 - i * 600) * 100) / 100.0);
            user.put("currentBalance", Math.round((5000 - i * 400) * 100) / 100.0);
            top10Users.add(user);
        }
        topUsers.set("users", top10Users);
        root.set("top10Users", topUsers);

        return root;
    }

    protected Map<String, ComplianceReport> getReportStore() {
        return reportStore;
    }
}
