package org.gradle.wrapper;

import java.io.File;
import java.net.URI;
import java.util.Locale;

public class PathAssembler {
    public File getDistributionBaseDir(WrapperConfiguration config) {
        String base = config.getDistributionBase();
        if ("GRADLE_USER_HOME".equals(base)) {
            return new File(getGradleUserHome(), config.getDistributionPath());
        } else if ("PROJECT".equals(base)) {
            return new File(System.getProperty("user.dir"), config.getDistributionPath());
        }
        return new File(base, config.getDistributionPath());
    }

    public File getZipBaseDir(WrapperConfiguration config) {
        String base = config.getZipBase();
        if ("GRADLE_USER_HOME".equals(base)) {
            return new File(getGradleUserHome(), config.getZipPath());
        } else if ("PROJECT".equals(base)) {
            return new File(System.getProperty("user.dir"), config.getZipPath());
        }
        return new File(base, config.getZipPath());
    }

    private File getGradleUserHome() {
        String gradleUserHome = System.getProperty("gradle.user.home");
        if (gradleUserHome != null && !gradleUserHome.isEmpty()) {
            return new File(gradleUserHome);
        }
        return new File(System.getProperty("user.home"), ".gradle");
    }
}
