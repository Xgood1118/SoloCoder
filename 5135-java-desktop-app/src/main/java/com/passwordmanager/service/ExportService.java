package com.passwordmanager.service;

import com.passwordmanager.database.DatabaseHelper;
import com.passwordmanager.model.Category;
import com.passwordmanager.model.PasswordEntry;
import com.passwordmanager.security.EncryptionUtil;
import com.passwordmanager.security.XssUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.List;

public class ExportService {
    private final DatabaseHelper dbHelper;
    private final Gson gson;

    public ExportService() {
        this.dbHelper = DatabaseHelper.getInstance();
        this.gson = new GsonBuilder().setPrettyPrinting().create();
    }

    public void exportToCsv(File file, String masterPassword) throws Exception {
        List<PasswordEntry> passwords = dbHelper.getAllPasswordEntries();
        List<Category> categories = dbHelper.getAllCategories();

        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                new FileOutputStream(file), StandardCharsets.UTF_8))) {
            writer.write('\ufeff');
            writer.write("分类,标题,用户名,密码,网址,备注\n");

            for (PasswordEntry entry : passwords) {
                String categoryName = getCategoryName(categories, entry.getCategoryId());
                String decryptedPassword = EncryptionUtil.decrypt(entry.getEncryptedPassword(), masterPassword);

                writer.write(XssUtil.escapeForCsv(categoryName) + ",");
                writer.write(XssUtil.escapeForCsv(entry.getTitle()) + ",");
                writer.write(XssUtil.escapeForCsv(entry.getUsername()) + ",");
                writer.write(XssUtil.escapeForCsv(decryptedPassword) + ",");
                writer.write(XssUtil.escapeForCsv(entry.getUrl()) + ",");
                writer.write(XssUtil.escapeForCsv(entry.getNotes()) + "\n");
            }
        }
    }

    public void exportToEncryptedBackup(File file, String masterPassword) throws Exception {
        List<PasswordEntry> passwords = dbHelper.getAllPasswordEntries();
        List<Category> categories = dbHelper.getAllCategories();

        BackupData data = new BackupData();
        data.setVersion("1.0");
        data.setCategories(categories);
        data.setPasswords(passwords);

        String json = gson.toJson(data);
        String encrypted = EncryptionUtil.encrypt(json, masterPassword);

        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(encrypted.getBytes(StandardCharsets.UTF_8));
        }
    }

    public void importFromEncryptedBackup(File file, String masterPassword) throws Exception {
        byte[] content = java.nio.file.Files.readAllBytes(file.toPath());
        String encrypted = new String(content, StandardCharsets.UTF_8);
        String json = EncryptionUtil.decrypt(encrypted, masterPassword);

        BackupData data = gson.fromJson(json, BackupData.class);

        if (data.getCategories() != null) {
            for (Category cat : data.getCategories()) {
                try {
                    dbHelper.addCategory(cat);
                } catch (SQLException e) {
                }
            }
        }

        if (data.getPasswords() != null) {
            for (PasswordEntry entry : data.getPasswords()) {
                try {
                    dbHelper.addPasswordEntry(entry);
                } catch (SQLException e) {
                }
            }
        }
    }

    private String getCategoryName(List<Category> categories, long categoryId) {
        for (Category cat : categories) {
            if (cat.getId() == categoryId) {
                return cat.getName();
            }
        }
        return "未分类";
    }

    public static class BackupData {
        private String version;
        private List<Category> categories;
        private List<PasswordEntry> passwords;

        public String getVersion() {
            return version;
        }

        public void setVersion(String version) {
            this.version = version;
        }

        public List<Category> getCategories() {
            return categories;
        }

        public void setCategories(List<Category> categories) {
            this.categories = categories;
        }

        public List<PasswordEntry> getPasswords() {
            return passwords;
        }

        public void setPasswords(List<PasswordEntry> passwords) {
            this.passwords = passwords;
        }
    }
}
