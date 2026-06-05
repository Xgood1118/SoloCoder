package com.passwordmanager.security;

import org.apache.commons.lang3.StringEscapeUtils;

public class XssUtil {

    private XssUtil() {
    }

    public static String escapeForHtml(String input) {
        if (input == null) {
            return null;
        }
        return StringEscapeUtils.escapeHtml4(input);
    }

    public static String escapeForXml(String input) {
        if (input == null) {
            return null;
        }
        return StringEscapeUtils.escapeXml11(input);
    }

    public static String escapeForCsv(String input) {
        if (input == null) {
            return "";
        }
        String escaped = input.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n") || escaped.contains("\r")) {
            escaped = "\"" + escaped + "\"";
        }
        return escaped;
    }

    public static String sanitizeForStorage(String input) {
        if (input == null) {
            return null;
        }
        return input.trim();
    }

    public static String sanitizeFileName(String fileName) {
        if (fileName == null) {
            return null;
        }
        return fileName.replaceAll("[<>:\"/\\\\|?*]", "_");
    }
}
