package com.audit.report;

import com.audit.common.model.ComplianceReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportArchiveService {

    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    private static final int IV_SIZE = 16;

    private final ReportConfig reportConfig;
    private final ReportGenerator reportGenerator;

    public ComplianceReport archive(ComplianceReport report) {
        try {
            Path sourcePath = Paths.get(report.getContentPath());
            if (!Files.exists(sourcePath)) {
                throw new IllegalArgumentException("Report file not found: " + report.getContentPath());
            }

            Path archiveDir = Paths.get(reportConfig.getArchivePath());
            Files.createDirectories(archiveDir);

            byte[] content = Files.readAllBytes(sourcePath);
            byte[] encryptedContent = encrypt(content);

            String archiveFileName = sourcePath.getFileName().toString() + ".enc";
            Path archivePath = archiveDir.resolve(archiveFileName);
            Files.write(archivePath, encryptedContent);

            Files.delete(sourcePath);

            report.setArchived(true);
            report.setArchivePath(archivePath.toAbsolutePath().toString());
            report.setContentPath(archivePath.toAbsolutePath().toString());

            log.info("Report archived successfully: {} -> {}", report.getId(), archivePath);
            return report;
        } catch (IOException e) {
            log.error("Failed to archive report", e);
            throw new RuntimeException("Failed to archive report", e);
        }
    }

    public byte[] retrieve(String reportId) {
        Map<String, ComplianceReport> reportStore = reportGenerator.getReportStore();
        ComplianceReport report = reportStore.get(reportId);
        if (report == null) {
            throw new IllegalArgumentException("Report not found: " + reportId);
        }

        if (!report.isArchived()) {
            try {
                return Files.readAllBytes(Paths.get(report.getContentPath()));
            } catch (IOException e) {
                throw new RuntimeException("Failed to read report content", e);
            }
        }

        try {
            Path archivePath = Paths.get(report.getArchivePath());
            byte[] encryptedContent = Files.readAllBytes(archivePath);
            return decrypt(encryptedContent);
        } catch (IOException e) {
            log.error("Failed to retrieve archived report", e);
            throw new RuntimeException("Failed to retrieve archived report", e);
        }
    }

    public int cleanup(Instant before) {
        Map<String, ComplianceReport> reportStore = reportGenerator.getReportStore();
        int deletedCount = 0;

        for (ComplianceReport report : reportStore.values()) {
            if (report.isArchived() && report.getGeneratedAt().isBefore(before)) {
                try {
                    Path archivePath = Paths.get(report.getArchivePath());
                    Files.deleteIfExists(archivePath);
                    reportStore.remove(report.getId());
                    deletedCount++;
                    log.info("Deleted expired archive: {}", report.getId());
                } catch (IOException e) {
                    log.error("Failed to delete expired archive: {}", report.getId(), e);
                }
            }
        }

        log.info("Cleanup completed. Deleted {} expired archives.", deletedCount);
        return deletedCount;
    }

    public int cleanupExpired() {
        Instant cutoff = Instant.now().minus(reportConfig.getRetentionDays(), ChronoUnit.DAYS);
        return cleanup(cutoff);
    }

    private byte[] encrypt(byte[] data) {
        try {
            byte[] keyBytes = deriveAes256Key(reportConfig.getEncryptionKey());
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

            byte[] iv = new byte[IV_SIZE];
            new SecureRandom().nextBytes(iv);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec);
            byte[] encrypted = cipher.doFinal(data);

            byte[] result = new byte[IV_SIZE + encrypted.length];
            System.arraycopy(iv, 0, result, 0, IV_SIZE);
            System.arraycopy(encrypted, 0, result, IV_SIZE, encrypted.length);

            return result;
        } catch (Exception e) {
            log.error("Failed to encrypt data", e);
            throw new RuntimeException("Failed to encrypt data", e);
        }
    }

    private byte[] decrypt(byte[] encryptedData) {
        try {
            if (encryptedData.length < IV_SIZE) {
                throw new IllegalArgumentException("Invalid encrypted data: too short");
            }

            byte[] keyBytes = deriveAes256Key(reportConfig.getEncryptionKey());
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

            byte[] iv = new byte[IV_SIZE];
            System.arraycopy(encryptedData, 0, iv, 0, IV_SIZE);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);

            byte[] cipherText = new byte[encryptedData.length - IV_SIZE];
            System.arraycopy(encryptedData, IV_SIZE, cipherText, 0, cipherText.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, ivSpec);
            return cipher.doFinal(cipherText);
        } catch (Exception e) {
            log.error("Failed to decrypt data", e);
            throw new RuntimeException("Failed to decrypt data", e);
        }
    }

    private byte[] deriveAes256Key(String keyMaterial) throws Exception {
        MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
        return sha256.digest(keyMaterial.getBytes(StandardCharsets.UTF_8));
    }
}
