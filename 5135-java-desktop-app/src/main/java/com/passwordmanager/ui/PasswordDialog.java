package com.passwordmanager.ui;

import com.passwordmanager.PasswordManagerApp;
import com.passwordmanager.database.DatabaseHelper;
import com.passwordmanager.model.Category;
import com.passwordmanager.model.PasswordEntry;
import com.passwordmanager.security.EncryptionUtil;
import com.passwordmanager.security.PasswordStrengthChecker;
import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.paint.Color;
import javafx.util.StringConverter;

import java.sql.SQLException;
import java.util.List;

public class PasswordDialog extends Dialog<PasswordEntry> {
    private final PasswordEntry entry;
    private final boolean isNew;
    private final DatabaseHelper dbHelper;

    private TextField titleField;
    private TextField usernameField;
    private TextField passwordField;
    private TextField urlField;
    private TextArea notesArea;
    private ComboBox<Category> categoryCombo;
    private Label strengthLabel;
    private ProgressBar strengthBar;

    public PasswordDialog(PasswordEntry entry, boolean isNew) {
        this.entry = entry;
        this.isNew = isNew;
        this.dbHelper = DatabaseHelper.getInstance();

        setTitle(isNew ? "添加密码" : "编辑密码");
        setHeaderText(isNew ? "输入新密码信息" : "修改密码信息");
        initOwner(PasswordManagerApp.getInstance().getPrimaryStage());

        ButtonType saveButtonType = new ButtonType("保存", ButtonBar.ButtonData.OK_DONE);
        getDialogPane().getButtonTypes().addAll(saveButtonType, ButtonType.CANCEL);

        buildUI();

        setResultConverter(dialogButton -> {
            if (dialogButton == saveButtonType) {
                return saveEntry();
            }
            return null;
        });

        titleField.requestFocus();
    }

    private void buildUI() {
        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.setPadding(new Insets(20, 150, 10, 10));

        titleField = new TextField();
        titleField.setPromptText("网站/应用名称");
        titleField.setPrefWidth(250);

        usernameField = new TextField();
        usernameField.setPromptText("用户名/邮箱");

        passwordField = new TextField();
        passwordField.setPromptText("密码");
        passwordField.textProperty().addListener((obs, oldVal, newVal) -> updatePasswordStrength(newVal));

        HBox passwordBox = new HBox(5);
        Button generateBtn = new Button("生成");
        generateBtn.getStyleClass().add("small-button");
        generateBtn.setOnAction(e -> {
            String generated = EncryptionUtil.generateRandomPassword(16);
            passwordField.setText(generated);
        });
        passwordBox.getChildren().addAll(passwordField, generateBtn);

        HBox strengthBox = new HBox(10);
        strengthBox.setAlignment(javafx.geometry.Pos.CENTER_LEFT);
        strengthLabel = new Label("密码强度: ");
        strengthBar = new ProgressBar(0);
        strengthBar.setPrefWidth(120);
        strengthBox.getChildren().addAll(strengthLabel, strengthBar);

        urlField = new TextField();
        urlField.setPromptText("https://");

        notesArea = new TextArea();
        notesArea.setPromptText("备注");
        notesArea.setPrefRowCount(3);

        categoryCombo = new ComboBox<>();
        categoryCombo.setConverter(new StringConverter<>() {
            @Override
            public String toString(Category cat) {
                return cat != null ? cat.getName() : "";
            }

            @Override
            public Category fromString(String string) {
                return null;
            }
        });

        try {
            List<Category> categories = dbHelper.getAllCategories();
            categoryCombo.getItems().addAll(categories);
            if (entry.getCategoryId() > 0) {
                for (Category cat : categories) {
                    if (cat.getId() == entry.getCategoryId()) {
                        categoryCombo.getSelectionModel().select(cat);
                        break;
                    }
                }
            } else if (!categories.isEmpty()) {
                categoryCombo.getSelectionModel().select(0);
            }
        } catch (SQLException e) {
            PasswordManagerApp.getInstance().showError("加载分类失败", e.getMessage());
        }

        grid.add(new Label("标题:"), 0, 0);
        grid.add(titleField, 1, 0);
        grid.add(new Label("分类:"), 0, 1);
        grid.add(categoryCombo, 1, 1);
        grid.add(new Label("用户名:"), 0, 2);
        grid.add(usernameField, 1, 2);
        grid.add(new Label("密码:"), 0, 3);
        grid.add(passwordBox, 1, 3);
        grid.add(strengthBox, 1, 4);
        grid.add(new Label("网址:"), 0, 5);
        grid.add(urlField, 1, 5);
        grid.add(new Label("备注:"), 0, 6);
        grid.add(notesArea, 1, 6);

        if (!isNew) {
            titleField.setText(entry.getTitle());
            usernameField.setText(entry.getUsername());
            urlField.setText(entry.getUrl());
            notesArea.setText(entry.getNotes());
            try {
                String masterPassword = PasswordManagerApp.getInstance().getMasterPassword();
                String decrypted = EncryptionUtil.decrypt(entry.getEncryptedPassword(), masterPassword);
                passwordField.setText(decrypted);
            } catch (Exception e) {
                PasswordManagerApp.getInstance().showError("解密失败", e.getMessage());
            }
        }

        getDialogPane().setContent(grid);
    }

    private void updatePasswordStrength(String password) {
        PasswordStrengthChecker.PasswordStrength strength = PasswordStrengthChecker.checkStrength(password);
        PasswordStrengthChecker.StrengthLevel level = strength.getLevel();

        strengthLabel.setText("密码强度: " + level.getDisplay());
        strengthLabel.setTextFill(Color.web(level.getColor()));

        double progress;
        switch (level) {
            case WEAK: progress = 0.33; break;
            case MEDIUM: progress = 0.66; break;
            case STRONG: progress = 1.0; break;
            default: progress = 0;
        }
        strengthBar.setProgress(progress);
    }

    private PasswordEntry saveEntry() {
        String title = titleField.getText().trim();
        if (title.isEmpty()) {
            PasswordManagerApp.getInstance().showError("验证失败", "标题不能为空");
            return null;
        }

        String password = passwordField.getText();
        if (password.isEmpty()) {
            PasswordManagerApp.getInstance().showError("验证失败", "密码不能为空");
            return null;
        }

        try {
            String masterPassword = PasswordManagerApp.getInstance().getMasterPassword();
            String encrypted = EncryptionUtil.encrypt(password, masterPassword);

            entry.setTitle(title);
            entry.setUsername(usernameField.getText().trim());
            entry.setEncryptedPassword(encrypted);
            entry.setUrl(urlField.getText().trim());
            entry.setNotes(notesArea.getText().trim());

            Category selectedCat = categoryCombo.getSelectionModel().getSelectedItem();
            if (selectedCat != null && !selectedCat.getName().equals("全部")) {
                entry.setCategoryId(selectedCat.getId());
            } else {
                entry.setCategoryId(0);
            }

            return entry;
        } catch (Exception e) {
            PasswordManagerApp.getInstance().showError("加密失败", e.getMessage());
            return null;
        }
    }
}
