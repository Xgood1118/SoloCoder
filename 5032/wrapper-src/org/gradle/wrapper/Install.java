package org.gradle.wrapper;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.URI;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class Install {
    private Logger logger;
    private Download download;
    private PathAssembler pathAssembler;

    public Install(Logger logger, Download download, PathAssembler pathAssembler) {
        this.logger = logger;
        this.download = download;
        this.pathAssembler = pathAssembler;
    }

    public File install(WrapperConfiguration config) throws Exception {
        File distDir = pathAssembler.getDistributionBaseDir(config);
        String distUrl = config.getDistributionUrl();
        String distName = getDistName(distUrl);
        File distDirForVersion = new File(distDir, distName);
        File gradleHome = new File(distDirForVersion, extractDistBase(distUrl));

        if (gradleHome.exists()) {
            logger.log("Found existing Gradle installation at " + gradleHome);
            return gradleHome;
        }

        File zipStoreDir = pathAssembler.getZipBaseDir(config);
        File zipFile = new File(zipStoreDir, distName + "/" + getDistHash(distUrl) + "/" + distName + ".zip");

        if (!zipFile.exists()) {
            download.download(new URI(distUrl), zipFile);
        }

        logger.log("Unzipping " + zipFile + " to " + distDirForVersion);
        unzip(zipFile, distDirForVersion);

        return gradleHome;
    }

    private String getDistName(String distUrl) {
        int lastSlash = distUrl.lastIndexOf('/');
        String fileName = lastSlash >= 0 ? distUrl.substring(lastSlash + 1) : distUrl;
        if (fileName.endsWith(".zip")) {
            fileName = fileName.substring(0, fileName.length() - 4);
        }
        return fileName;
    }

    private String extractDistBase(String distUrl) {
        int lastSlash = distUrl.lastIndexOf('/');
        String fileName = lastSlash >= 0 ? distUrl.substring(lastSlash + 1) : distUrl;
        if (fileName.endsWith(".zip")) {
            fileName = fileName.substring(0, fileName.length() - 4);
        }
        if (fileName.endsWith("-bin")) {
            fileName = fileName.substring(0, fileName.length() - 4);
        } else if (fileName.endsWith("-all")) {
            fileName = fileName.substring(0, fileName.length() - 4);
        }
        return fileName;
    }

    private String getDistHash(String distUrl) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(distUrl.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private void unzip(File zipFile, File destDir) throws Exception {
        destDir.mkdirs();
        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                File outFile = new File(destDir, entry.getName());
                if (entry.getName().startsWith("..") || entry.getName().contains("..")) {
                    continue;
                }
                if (entry.isDirectory()) {
                    outFile.mkdirs();
                } else {
                    outFile.getParentFile().mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        byte[] buffer = new byte[65536];
                        int len;
                        while ((len = zis.read(buffer)) > 0) {
                            fos.write(buffer, 0, len);
                        }
                    }
                }
                zis.closeEntry();
            }
        }
    }
}
