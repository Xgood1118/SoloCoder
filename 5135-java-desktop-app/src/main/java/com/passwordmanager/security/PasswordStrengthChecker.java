package com.passwordmanager.security;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class PasswordStrengthChecker {
    private static final Set<String> WEAK_PASSWORDS = new HashSet<>();
    private static final String WEAK_PASSWORDS_FILE = "/weak_passwords.txt";

    static {
        loadWeakPasswords();
    }

    private PasswordStrengthChecker() {
    }

    private static void loadWeakPasswords() {
        try (InputStream is = PasswordStrengthChecker.class.getResourceAsStream(WEAK_PASSWORDS_FILE)) {
            if (is != null) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                String line;
                while ((line = reader.readLine()) != null) {
                    WEAK_PASSWORDS.add(line.trim().toLowerCase());
                }
            }
        } catch (Exception e) {
        }
    }

    public static PasswordStrength checkStrength(String password) {
        if (password == null || password.isEmpty()) {
            return new PasswordStrength(StrengthLevel.NONE, 0, "请输入密码");
        }

        int score = 0;
        StringBuilder feedback = new StringBuilder();

        if (isCommonWeakPassword(password)) {
            return new PasswordStrength(StrengthLevel.WEAK, 1, "密码过于常见，存在泄露风险");
        }

        int length = password.length();
        if (length >= 8) {
            score += 1;
        } else {
            feedback.append("密码长度建议至少8位；");
        }
        if (length >= 12) {
            score += 1;
        }

        boolean hasLower = false, hasUpper = false, hasDigit = false, hasSpecial = false;
        for (char c : password.toCharArray()) {
            if (Character.isLowerCase(c)) hasLower = true;
            else if (Character.isUpperCase(c)) hasUpper = true;
            else if (Character.isDigit(c)) hasDigit = true;
            else hasSpecial = true;
        }

        int charTypes = 0;
        if (hasLower) charTypes++;
        if (hasUpper) charTypes++;
        if (hasDigit) charTypes++;
        if (hasSpecial) charTypes++;

        score += charTypes;

        if (charTypes < 3) {
            feedback.append("建议包含大小写字母、数字和特殊字符；");
        }

        if (hasRepeatedCharacters(password)) {
            score -= 1;
            feedback.append("避免重复字符；");
        }

        if (hasSequentialCharacters(password)) {
            score -= 1;
            feedback.append("避免连续字符序列；");
        }

        StrengthLevel level;
        if (score <= 2) {
            level = StrengthLevel.WEAK;
        } else if (score <= 4) {
            level = StrengthLevel.MEDIUM;
        } else {
            level = StrengthLevel.STRONG;
        }

        String feedbackStr = feedback.length() > 0 ? feedback.toString() : "密码强度良好";
        return new PasswordStrength(level, Math.max(0, score), feedbackStr);
    }

    private static boolean isCommonWeakPassword(String password) {
        return WEAK_PASSWORDS.contains(password.toLowerCase());
    }

    private static boolean hasRepeatedCharacters(String password) {
        for (int i = 0; i < password.length() - 2; i++) {
            if (password.charAt(i) == password.charAt(i + 1) && password.charAt(i) == password.charAt(i + 2)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasSequentialCharacters(String password) {
        String lower = password.toLowerCase();
        String sequences = "abcdefghijklmnopqrstuvwxyz0123456789";
        for (int i = 0; i < sequences.length() - 2; i++) {
            String seq = sequences.substring(i, i + 3);
            if (lower.contains(seq)) {
                return true;
            }
        }
        return false;
    }

    public enum StrengthLevel {
        NONE("无", "#9E9E9E"),
        WEAK("弱", "#F44336"),
        MEDIUM("中", "#FF9800"),
        STRONG("强", "#4CAF50");

        private final String display;
        private final String color;

        StrengthLevel(String display, String color) {
            this.display = display;
            this.color = color;
        }

        public String getDisplay() {
            return display;
        }

        public String getColor() {
            return color;
        }
    }

    public static class PasswordStrength {
        private final StrengthLevel level;
        private final int score;
        private final String feedback;

        public PasswordStrength(StrengthLevel level, int score, String feedback) {
            this.level = level;
            this.score = score;
            this.feedback = feedback;
        }

        public StrengthLevel getLevel() {
            return level;
        }

        public int getScore() {
            return score;
        }

        public String getFeedback() {
            return feedback;
        }
    }
}
