package org.gradle.wrapper;

import java.io.File;
import java.net.URI;

public class Download {
    private Logger logger;

    public Download(Logger logger) {
        this.logger = logger;
    }

    public void download(URI address, File destination) throws Exception {
        destination.getParentFile().mkdirs();
        String url = address.toString();
        logger.log("Downloading " + url);

        if (tryDownloadWithCurl(url, destination)) {
            logger.log("Download complete (" + destination.length() + " bytes)");
            return;
        }

        logger.log("Curl failed, trying Java URLConnection...");
        downloadWithJava(url, destination);
        logger.log("Download complete (" + destination.length() + " bytes)");
    }

    private boolean tryDownloadWithCurl(String url, File destination) {
        try {
            String curlCmd = findCurl();
            if (curlCmd == null) {
                return false;
            }

            ProcessBuilder pb = new ProcessBuilder(
                curlCmd,
                "-L",
                "--connect-timeout", "60",
                "--max-time", "1800",
                "-k",
                "-o", destination.getAbsolutePath(),
                url
            );

            if (url.contains("tencent.com") || url.contains("aliyun.com") || url.contains("huaweicloud.com")) {
                // China mirror - should work fine
            } else {
                // Foreign domain - use direct IP

                pb = new ProcessBuilder(
                    curlCmd,
                    "-L",
                    "--connect-timeout", "60",
                    "--max-time", "1800",
                    "-k",
                    "--resolve", "services.gradle.org:443:104.16.72.101",
                    "--resolve", "downloads.gradle.org:443:104.16.72.101",
                    "--resolve", "github.com:443:20.205.243.166",
                    "-o", destination.getAbsolutePath(),
                    url
                );
            }

            pb.redirectErrorStream(true);
            Process process = pb.start();

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = process.getInputStream().read(buffer)) != -1) {
                System.out.write(buffer, 0, bytesRead);
            }

            int exitCode = process.waitFor();
            if (exitCode == 0 && destination.exists() && destination.length() > 1000000) {
                return true;
            }
        } catch (Exception e) {
            logger.logError("Curl download failed: " + e.getMessage());
        }
        return false;
    }

    private String findCurl() {
        String[] paths = {"curl.exe", "curl", "/usr/bin/curl", "/usr/local/bin/curl"};
        for (String path : paths) {
            try {
                ProcessBuilder pb = new ProcessBuilder(path, "--version");
                Process p = pb.start();
                if (p.waitFor() == 0) {
                    return path;
                }
            } catch (Exception e) {
                // continue
            }
        }
        return null;
    }

    private void downloadWithJava(String url, File destination) throws Exception {
        java.net.URLConnection connection = new java.net.URL(url).openConnection();
        connection.setConnectTimeout(60000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("User-Agent", "Gradle Wrapper");

        try (java.io.InputStream in = connection.getInputStream();
             java.io.FileOutputStream out = new java.io.FileOutputStream(destination)) {
            byte[] buffer = new byte[65536];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
        }
    }
}
