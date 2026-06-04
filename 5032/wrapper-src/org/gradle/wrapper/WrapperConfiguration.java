package org.gradle.wrapper;

import java.io.File;
import java.io.FileInputStream;
import java.util.Properties;

public class WrapperConfiguration {
    private String distributionBase;
    private String distributionPath;
    private String zipBase;
    private String zipPath;
    private String distributionUrl;
    private String distributionSha256Sum;

    public WrapperConfiguration() {
        this.distributionBase = "GRADLE_USER_HOME";
        this.distributionPath = "wrapper/dists";
        this.zipBase = "GRADLE_USER_HOME";
        this.zipPath = "wrapper/dists";
    }

    public void load(File propertiesFile) throws Exception {
        Properties props = new Properties();
        try (FileInputStream fis = new FileInputStream(propertiesFile)) {
            props.load(fis);
        }
        distributionBase = props.getProperty("distributionBase", distributionBase);
        distributionPath = props.getProperty("distributionPath", distributionPath);
        zipBase = props.getProperty("zipBase", zipBase);
        zipPath = props.getProperty("zipPath", zipPath);
        distributionUrl = props.getProperty("distributionUrl", distributionUrl);
        distributionSha256Sum = props.getProperty("distributionSha256Sum", null);
    }

    public String getDistributionBase() { return distributionBase; }
    public String getDistributionPath() { return distributionPath; }
    public String getZipBase() { return zipBase; }
    public String getZipPath() { return zipPath; }
    public String getDistributionUrl() { return distributionUrl; }
    public String getDistributionSha256Sum() { return distributionSha256Sum; }
}
