package com.audit.report;

import com.audit.common.model.ComplianceReport;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.springframework.stereotype.Component;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.*;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Date;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReportSigner {

    private static final String KEY_ALIAS = "audit-report-signing-key";
    private static final String SIGNATURE_ALGORITHM = "SHA256withRSA";
    private static final String KEYSTORE_TYPE = "PKCS12";

    private final ReportConfig reportConfig;

    private PrivateKey privateKey;
    private PublicKey publicKey;

    @PostConstruct
    public void init() {
        Security.addProvider(new BouncyCastleProvider());
        try {
            loadOrGenerateKeyPair();
        } catch (Exception e) {
            log.error("Failed to initialize report signer", e);
            throw new RuntimeException("Failed to initialize report signer", e);
        }
    }

    private void loadOrGenerateKeyPair() throws Exception {
        Path keystorePath = Paths.get(reportConfig.getKeystorePath());
        char[] password = reportConfig.getKeystorePassword().toCharArray();

        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_TYPE);

        if (Files.exists(keystorePath)) {
            try (FileInputStream fis = new FileInputStream(keystorePath.toFile())) {
                keyStore.load(fis, password);
            }
            privateKey = (PrivateKey) keyStore.getKey(KEY_ALIAS, password);
            publicKey = keyStore.getCertificate(KEY_ALIAS).getPublicKey();
            log.info("Loaded existing key pair from keystore: {}", keystorePath);
        } else {
            if (keystorePath.getParent() != null) {
                Files.createDirectories(keystorePath.getParent());
            }
            keyStore.load(null, password);

            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA", "BC");
            keyGen.initialize(2048, new SecureRandom());
            KeyPair keyPair = keyGen.generateKeyPair();
            privateKey = keyPair.getPrivate();
            publicKey = keyPair.getPublic();

            X509Certificate cert = generateSelfSignedCertificate(keyPair);
            keyStore.setKeyEntry(KEY_ALIAS, privateKey, password,
                    new java.security.cert.Certificate[]{cert});

            try (FileOutputStream fos = new FileOutputStream(keystorePath.toFile())) {
                keyStore.store(fos, password);
            }
            log.info("Generated new key pair and saved to keystore: {}", keystorePath);
        }
    }

    private X509Certificate generateSelfSignedCertificate(KeyPair keyPair) throws Exception {
        X500Name dnName = new X500Name("CN=AuditReportSigner, O=Audit, L=Global, C=US");
        long validity = 10L * 365 * 24 * 60 * 60 * 1000;
        long now = System.currentTimeMillis();
        Date startDate = new Date(now);
        Date endDate = new Date(now + validity);
        BigInteger serialNumber = BigInteger.valueOf(now);

        SubjectPublicKeyInfo publicKeyInfo = SubjectPublicKeyInfo.getInstance(keyPair.getPublic().getEncoded());

        X509v3CertificateBuilder certBuilder = new X509v3CertificateBuilder(
                dnName,
                serialNumber,
                startDate,
                endDate,
                dnName,
                publicKeyInfo
        );

        ContentSigner contentSigner = new JcaContentSignerBuilder(SIGNATURE_ALGORITHM)
                .setProvider("BC")
                .build(keyPair.getPrivate());

        X509CertificateHolder certHolder = certBuilder.build(contentSigner);
        return new JcaX509CertificateConverter()
                .setProvider("BC")
                .getCertificate(certHolder);
    }

    public String sign(byte[] data) {
        try {
            Signature signature = Signature.getInstance(SIGNATURE_ALGORITHM, "BC");
            signature.initSign(privateKey);
            signature.update(data);
            byte[] signedData = signature.sign();
            return Base64.getEncoder().encodeToString(signedData);
        } catch (Exception e) {
            log.error("Failed to sign data", e);
            throw new RuntimeException("Failed to sign data", e);
        }
    }

    public boolean verify(byte[] data, String signatureStr) {
        try {
            Signature signature = Signature.getInstance(SIGNATURE_ALGORITHM, "BC");
            signature.initVerify(publicKey);
            signature.update(data);
            byte[] signatureBytes = Base64.getDecoder().decode(signatureStr);
            return signature.verify(signatureBytes);
        } catch (Exception e) {
            log.error("Failed to verify signature", e);
            return false;
        }
    }

    public void signReport(ComplianceReport report) {
        try {
            Path filePath = Paths.get(report.getContentPath());
            if (!Files.exists(filePath)) {
                throw new IllegalArgumentException("Report file not found: " + report.getContentPath());
            }

            byte[] content = Files.readAllBytes(filePath);
            String digitalSignature = sign(content);

            report.setDigitalSignature(digitalSignature);
            report.setSignAlgorithm(SIGNATURE_ALGORITHM);

            log.info("Report signed successfully: {}", report.getId());
        } catch (IOException e) {
            log.error("Failed to read report file for signing", e);
            throw new RuntimeException("Failed to read report file for signing", e);
        }
    }

    public PublicKey getPublicKey() {
        return publicKey;
    }
}
