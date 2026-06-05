package com.passwordmanager.database;

import com.passwordmanager.model.Category;
import com.passwordmanager.model.PasswordEntry;
import at.favre.lib.crypto.bcrypt.BCrypt;
import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.io.File;

public class DatabaseHelper {
    private static final String DB_FILENAME = "passwords.db";
    private static DatabaseHelper instance;
    private Connection connection;
    private String dbPath;

    private DatabaseHelper() {
        initDbPath();
    }

    public static DatabaseHelper getInstance() {
        if (instance == null) {
            instance = new DatabaseHelper();
        }
        return instance;
    }

    private void initDbPath() {
        String userHome = System.getProperty("user.home");
        File appDir = new File(userHome, ".passwordmanager");
        if (!appDir.exists()) {
            appDir.mkdirs();
        }
        dbPath = new File(appDir, DB_FILENAME).getAbsolutePath();
    }

    public String getDbPath() {
        return dbPath;
    }

    public void setDbPath(String path) {
        this.dbPath = path;
    }

    public boolean databaseExists() {
        return new File(dbPath).exists();
    }

    public void connect() throws SQLException {
        if (connection == null || connection.isClosed()) {
            String url = "jdbc:sqlite:" + dbPath;
            connection = DriverManager.getConnection(url);
            connection.createStatement().execute("PRAGMA foreign_keys = ON;");
        }
    }

    public void close() throws SQLException {
        if (connection != null && !connection.isClosed()) {
            connection.close();
        }
    }

    public void initializeDatabase() throws SQLException {
        connect();
        try (Statement stmt = connection.createStatement()) {
            stmt.execute("CREATE TABLE IF NOT EXISTS settings (" +
                    "key TEXT PRIMARY KEY," +
                    "value TEXT NOT NULL" +
                    ");");

            stmt.execute("CREATE TABLE IF NOT EXISTS categories (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "name TEXT NOT NULL," +
                    "sort_order INTEGER DEFAULT 0," +
                    "icon TEXT" +
                    ");");

            stmt.execute("CREATE TABLE IF NOT EXISTS passwords (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "category_id INTEGER," +
                    "title TEXT NOT NULL," +
                    "username TEXT," +
                    "encrypted_password TEXT NOT NULL," +
                    "url TEXT," +
                    "notes TEXT," +
                    "sort_order INTEGER DEFAULT 0," +
                    "created_at TEXT NOT NULL," +
                    "updated_at TEXT NOT NULL," +
                    "FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL" +
                    ");");

            stmt.execute("CREATE INDEX IF NOT EXISTS idx_passwords_category ON passwords(category_id);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_passwords_title ON passwords(title);");

            insertDefaultCategories(stmt);
        }
    }

    private void insertDefaultCategories(Statement stmt) throws SQLException {
        ResultSet rs = stmt.executeQuery("SELECT COUNT(*) as count FROM categories;");
        if (rs.next() && rs.getInt("count") == 0) {
            String[] defaultCategories = {"全部", "工作", "个人", "社交", "理财"};
            for (int i = 0; i < defaultCategories.length; i++) {
                String sql = String.format("INSERT INTO categories (name, sort_order) VALUES ('%s', %d);",
                        defaultCategories[i], i);
                stmt.execute(sql);
            }
        }
    }

    public boolean verifyMasterPassword(String password) throws SQLException {
        connect();
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT value FROM settings WHERE key = 'master_password';")) {
            if (rs.next()) {
                String storedHash = rs.getString("value");
                BCrypt.Result result = BCrypt.verifyer().verify(password.toCharArray(), storedHash);
                return result.verified;
            }
        }
        return false;
    }

    public void setMasterPassword(String password) throws SQLException {
        connect();
        String hash = BCrypt.withDefaults().hashToString(12, password.toCharArray());
        try (PreparedStatement pstmt = connection.prepareStatement(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('master_password', ?);")) {
            pstmt.setString(1, hash);
            pstmt.executeUpdate();
        }
    }

    public boolean hasMasterPassword() throws SQLException {
        connect();
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT value FROM settings WHERE key = 'master_password';")) {
            return rs.next();
        }
    }

    public List<Category> getAllCategories() throws SQLException {
        connect();
        List<Category> categories = new ArrayList<>();
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM categories ORDER BY sort_order, id;")) {
            while (rs.next()) {
                Category cat = new Category();
                cat.setId(rs.getLong("id"));
                cat.setName(rs.getString("name"));
                cat.setSortOrder(rs.getInt("sort_order"));
                cat.setIcon(rs.getString("icon"));
                categories.add(cat);
            }
        }
        return categories;
    }

    public long addCategory(Category category) throws SQLException {
        connect();
        String sql = "INSERT INTO categories (name, sort_order, icon) VALUES (?, ?, ?);";
        try (PreparedStatement pstmt = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            pstmt.setString(1, category.getName());
            pstmt.setInt(2, category.getSortOrder());
            pstmt.setString(3, category.getIcon());
            pstmt.executeUpdate();
            ResultSet rs = pstmt.getGeneratedKeys();
            if (rs.next()) {
                return rs.getLong(1);
            }
        }
        return -1;
    }

    public void updateCategory(Category category) throws SQLException {
        connect();
        String sql = "UPDATE categories SET name = ?, sort_order = ?, icon = ? WHERE id = ?;";
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setString(1, category.getName());
            pstmt.setInt(2, category.getSortOrder());
            pstmt.setString(3, category.getIcon());
            pstmt.setLong(4, category.getId());
            pstmt.executeUpdate();
        }
    }

    public void deleteCategory(long categoryId) throws SQLException {
        connect();
        String sql = "DELETE FROM categories WHERE id = ?;";
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setLong(1, categoryId);
            pstmt.executeUpdate();
        }
    }

    public List<PasswordEntry> getPasswordsByCategory(long categoryId) throws SQLException {
        connect();
        List<PasswordEntry> passwords = new ArrayList<>();
        String sql;
        if (categoryId <= 0) {
            sql = "SELECT * FROM passwords ORDER BY sort_order, created_at DESC;";
        } else {
            sql = "SELECT * FROM passwords WHERE category_id = ? ORDER BY sort_order, created_at DESC;";
        }

        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            if (categoryId > 0) {
                pstmt.setLong(1, categoryId);
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    passwords.add(mapResultSetToPasswordEntry(rs));
                }
            }
        }
        return passwords;
    }

    public List<PasswordEntry> searchPasswords(String keyword, boolean exactMatch) throws SQLException {
        connect();
        List<PasswordEntry> passwords = new ArrayList<>();
        String sql;

        if (exactMatch) {
            sql = "SELECT * FROM passwords WHERE title = ? OR username = ? OR url = ? OR notes = ?;";
        } else {
            sql = "SELECT * FROM passwords WHERE title LIKE ? OR username LIKE ? OR url LIKE ? OR notes LIKE ?;";
            keyword = "%" + keyword + "%";
        }

        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setString(1, keyword);
            pstmt.setString(2, keyword);
            pstmt.setString(3, keyword);
            pstmt.setString(4, keyword);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    passwords.add(mapResultSetToPasswordEntry(rs));
                }
            }
        }
        return passwords;
    }

    public long addPasswordEntry(PasswordEntry entry) throws SQLException {
        connect();
        String sql = "INSERT INTO passwords (category_id, title, username, encrypted_password, url, notes, sort_order, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);";
        LocalDateTime now = LocalDateTime.now();
        try (PreparedStatement pstmt = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            pstmt.setLong(1, entry.getCategoryId());
            pstmt.setString(2, entry.getTitle());
            pstmt.setString(3, entry.getUsername());
            pstmt.setString(4, entry.getEncryptedPassword());
            pstmt.setString(5, entry.getUrl());
            pstmt.setString(6, entry.getNotes());
            pstmt.setInt(7, entry.getSortOrder());
            pstmt.setString(8, now.toString());
            pstmt.setString(9, now.toString());
            pstmt.executeUpdate();
            ResultSet rs = pstmt.getGeneratedKeys();
            if (rs.next()) {
                return rs.getLong(1);
            }
        }
        return -1;
    }

    public void updatePasswordEntry(PasswordEntry entry) throws SQLException {
        connect();
        String sql = "UPDATE passwords SET category_id = ?, title = ?, username = ?, encrypted_password = ?, " +
                "url = ?, notes = ?, sort_order = ?, updated_at = ? WHERE id = ?;";
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setLong(1, entry.getCategoryId());
            pstmt.setString(2, entry.getTitle());
            pstmt.setString(3, entry.getUsername());
            pstmt.setString(4, entry.getEncryptedPassword());
            pstmt.setString(5, entry.getUrl());
            pstmt.setString(6, entry.getNotes());
            pstmt.setInt(7, entry.getSortOrder());
            pstmt.setString(8, LocalDateTime.now().toString());
            pstmt.setLong(9, entry.getId());
            pstmt.executeUpdate();
        }
    }

    public void deletePasswordEntry(long entryId) throws SQLException {
        connect();
        String sql = "DELETE FROM passwords WHERE id = ?;";
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setLong(1, entryId);
            pstmt.executeUpdate();
        }
    }

    public PasswordEntry getPasswordEntry(long id) throws SQLException {
        connect();
        String sql = "SELECT * FROM passwords WHERE id = ?;";
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setLong(1, id);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return mapResultSetToPasswordEntry(rs);
                }
            }
        }
        return null;
    }

    public List<PasswordEntry> getAllPasswordEntries() throws SQLException {
        connect();
        List<PasswordEntry> passwords = new ArrayList<>();
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM passwords ORDER BY id;")) {
            while (rs.next()) {
                passwords.add(mapResultSetToPasswordEntry(rs));
            }
        }
        return passwords;
    }

    private PasswordEntry mapResultSetToPasswordEntry(ResultSet rs) throws SQLException {
        PasswordEntry entry = new PasswordEntry();
        entry.setId(rs.getLong("id"));
        entry.setCategoryId(rs.getLong("category_id"));
        entry.setTitle(rs.getString("title"));
        entry.setUsername(rs.getString("username"));
        entry.setEncryptedPassword(rs.getString("encrypted_password"));
        entry.setUrl(rs.getString("url"));
        entry.setNotes(rs.getString("notes"));
        entry.setSortOrder(rs.getInt("sort_order"));
        String createdAt = rs.getString("created_at");
        String updatedAt = rs.getString("updated_at");
        if (createdAt != null) entry.setCreatedAt(LocalDateTime.parse(createdAt));
        if (updatedAt != null) entry.setUpdatedAt(LocalDateTime.parse(updatedAt));
        return entry;
    }

    public String getSetting(String key, String defaultValue) throws SQLException {
        connect();
        String sql = "SELECT value FROM settings WHERE key = ?;";
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setString(1, key);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("value");
                }
            }
        }
        return defaultValue;
    }

    public void setSetting(String key, String value) throws SQLException {
        connect();
        String sql = "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);";
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setString(1, key);
            pstmt.setString(2, value);
            pstmt.executeUpdate();
        }
    }
}
