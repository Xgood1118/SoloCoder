package org.gradle.wrapper;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

public class GradleWrapperMain {
    public static final String DEFAULT_PROPERTIES_FILENAME = "gradle-wrapper.properties";
    public static final String WRAPPER_JAR_PATH = "gradle/wrapper/gradle-wrapper.jar";

    public static void main(String[] args) throws Exception {
        File wrapperJarFile = findWrapperJar();
        File propertiesFile = new File(wrapperJarFile.getParentFile(), DEFAULT_PROPERTIES_FILENAME);

        WrapperConfiguration config = new WrapperConfiguration();
        config.load(propertiesFile);

        Logger logger = new Logger(false);
        Download download = new Download(logger);
        PathAssembler pathAssembler = new PathAssembler();
        Install install = new Install(logger, download, pathAssembler);

        File gradleHome = install.install(config);

        launchGradle(gradleHome, args);
    }

    private static File findWrapperJar() {
        File jarFile = new File(GradleWrapperMain.class.getProtectionDomain()
                .getCodeSource().getLocation().getPath());
        try {
            return jarFile.getCanonicalFile();
        } catch (IOException e) {
            return jarFile;
        }
    }

    private static void launchGradle(File gradleHome, String[] args) throws Exception {
        boolean isWindows = File.separatorChar == '\\';
        String gradleScript = isWindows ? "gradle.bat" : "gradle";
        File scriptFile = new File(gradleHome, "bin" + File.separator + gradleScript);

        if (scriptFile.exists()) {
            launchWithScript(scriptFile, args);
            return;
        }

        launchWithJava(gradleHome, args);
    }

    private static void launchWithScript(File script, String[] args) throws Exception {
        List<String> command = new ArrayList<>();
        command.add(script.getAbsolutePath());
        for (String arg : args) {
            command.add(arg);
        }

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(new File(System.getProperty("user.dir")));
        pb.redirectErrorStream(true);

        Process process = pb.start();

        byte[] buffer = new byte[65536];
        int bytesRead;
        while ((bytesRead = process.getInputStream().read(buffer)) != -1) {
            System.out.write(buffer, 0, bytesRead);
            System.out.flush();
        }

        int exitCode = process.waitFor();
        System.exit(exitCode);
    }

    private static void launchWithJava(File gradleHome, String[] args) throws Exception {
        String javaHome = System.getProperty("java.home");
        String javaExec = javaHome != null
                ? new File(javaHome, "bin/java").getAbsolutePath()
                : "java";

        File libDir = new File(gradleHome, "lib");
        File launcherJar = findJar(libDir, "gradle-launcher");
        File agentJar = findJar(new File(gradleHome, "lib/agents"), "gradle-instrumentation-agent");

        if (launcherJar == null) {
            System.err.println("Could not find gradle-launcher JAR in " + libDir);
            System.exit(1);
        }

        List<String> command = new ArrayList<>();
        command.add(javaExec);

        if (agentJar != null) {
            command.add("-javaagent:" + agentJar.getAbsolutePath());
        }

        command.add("-Xmx64m");
        command.add("-Xms64m");
        command.add("-classpath");
        command.add(launcherJar.getAbsolutePath());
        command.add("org.gradle.launcher.GradleMain");

        for (String arg : args) {
            command.add(arg);
        }

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(new File(System.getProperty("user.dir")));
        pb.redirectErrorStream(true);

        Process process = pb.start();

        byte[] buffer = new byte[65536];
        int bytesRead;
        while ((bytesRead = process.getInputStream().read(buffer)) != -1) {
            System.out.write(buffer, 0, bytesRead);
            System.out.flush();
        }

        int exitCode = process.waitFor();
        System.exit(exitCode);
    }

    private static File findJar(File dir, String prefix) {
        if (!dir.isDirectory()) return null;
        File[] files = dir.listFiles((d, name) -> name.startsWith(prefix) && name.endsWith(".jar"));
        if (files != null && files.length > 0) {
            return files[0];
        }
        return null;
    }
}
