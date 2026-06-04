package org.gradle.wrapper;

public class Logger {
    private boolean quiet;

    public Logger(boolean quiet) {
        this.quiet = quiet;
    }

    public void log(String message) {
        if (!quiet) {
            System.out.println(message);
        }
    }

    public void logError(String message) {
        System.err.println(message);
    }
}
