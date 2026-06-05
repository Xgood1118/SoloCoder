package com.passwordmanager.model;

import com.passwordmanager.security.XssUtil;
import java.time.LocalDateTime;

public class PasswordEntry {
    private long id;
    private long categoryId;
    private String title;
    private String username;
    private String encryptedPassword;
    private String url;
    private String notes;
    private int sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public PasswordEntry() {
    }

    public PasswordEntry(String title, String username, String encryptedPassword, String url, String notes) {
        this.title = title;
        this.username = username;
        this.encryptedPassword = encryptedPassword;
        this.url = url;
        this.notes = notes;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(long categoryId) {
        this.categoryId = categoryId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = XssUtil.sanitizeForStorage(title);
    }

    public String getTitleForDisplay() {
        return XssUtil.escapeForHtml(title);
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = XssUtil.sanitizeForStorage(username);
    }

    public String getEncryptedPassword() {
        return encryptedPassword;
    }

    public void setEncryptedPassword(String encryptedPassword) {
        this.encryptedPassword = encryptedPassword;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = XssUtil.sanitizeForStorage(url);
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = XssUtil.sanitizeForStorage(notes);
    }

    public String getNotesForDisplay() {
        return XssUtil.escapeForHtml(notes);
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
