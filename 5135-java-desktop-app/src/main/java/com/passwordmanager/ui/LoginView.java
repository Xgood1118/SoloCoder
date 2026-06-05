package com.passwordmanager.ui;

import com.passwordmanager.PasswordManagerApp;
import com.passwordmanager.database.DatabaseHelper;
import com.passwordmanager.security.PasswordStrengthChecker;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Parent;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;

import java.sql.SQLException;

public class LoginView {
    private VBox root;
    private DatabaseHelper dbHelper;
    private PasswordField passwordField;
    private PasswordField confirmPasswordField;
    private Label messageLabel;
    private Label strengthLabel;
    private ProgressBar strengthBar;
    private boolean isFirstRun;

    public LoginView() {
        this.dbHelper = DatabaseHelper.getInstance();
        checkFirstRun();
        buildUI();
    }

    private void checkFirstRun() {
        try {
            isFirstRun = !dbHelper.hasMasterPassword();
        } catch (SQLException e) {
            isFirstRun = true;
        }
    }

    private void buildUI() {
        root = new VBox(20);
        root.setAlignment(Pos.CENTER);
        root.setPadding(new Insets(50));
        root.getStyleClass().add("login-background");

        Label titleLabel = new Label(isFirstRun ? "设置主密码" : "密码管理器");
        titleLabel.getStyleClass().add("login-title");

        Label subtitleLabel = new Label(isFirstRun ? "请设置一个强密码来保护您的数据" : "请输入主密码解锁");
        subtitleLabel.getStyleClass().add("login-subtitle");

        passwordField = new PasswordField();
        passwordField.setPromptText("主密码");
        passwordField.getStyleClass().add("login-input");
        passwordField.setMaxWidth(300);

        VBox contentBox = new VBox(15);
        contentBox.setAlignment(Pos.CENTER);
        contentBox.getChildren().addAll(titleLabel, subtitleLabel, passwordField);

        if (isFirstRun) {
            confirmPasswordField = new PasswordField();
            confirmPasswordField.setPromptText("确认主密码");
            confirmPasswordField.getStyleClass().add("login-input");
            confirmPasswordField.setMaxWidth(300);

            HBox strengthBox = new HBox(10);
            strengthBox.setAlignment(Pos.CENTER_LEFT);
            strengthBox.setMaxWidth(300);

            strengthLabel = new Label("密码强度: ");
            strengthLabel.getStyleClass().add("strength-label");

            strengthBar = new ProgressBar(0);
            strengthBar.setPrefWidth(150);
            strengthBar.getStyleClass().add("strength-bar");

            strengthBox.getChildren().addAll(strengthLabel, strengthBar);

            passwordField.textProperty().addListener((obs, oldVal, newVal) -> updatePasswordStrength(newVal));

            contentBox.getChildren().addAll(confirmPasswordField, strengthBox);
        }

        Button loginButton = new Button(isFirstRun ? "设置" : "解锁");
        loginButton.getStyleClass().add("login-button");
        loginButton.setPrefWidth(120);
        loginButton.setOnAction(e -> handleLogin());

        messageLabel = new Label();
        messageLabel.getStyleClass().add("error-message");
        messageLabel.setWrapText(true);
        messageLabel.setMaxWidth(300);

        contentBox.getChildren().addAll(loginButton, messageLabel);

        root.getChildren().add(contentBox);

        passwordField.setOnAction(e -> {
            if (isFirstRun && confirmPasswordField != null) {
                confirmPasswordField.requestFocus();
            } else {
                handleLogin();
            }
        });

        if (confirmPasswordField != null) {
            confirmPasswordField.setOnAction(e -> handleLogin());
        }
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

    private void handleLogin() {
        String password = passwordField.getText().trim();

        if (password.isEmpty()) {
            showError("请输入主密码");
            return;
        }

        try {
            if (isFirstRun) {
                String confirmPassword = confirmPasswordField.getText().trim();
                if (!password.equals(confirmPassword)) {
                    showError("两次输入的密码不一致");
                    return;
                }

                PasswordStrengthChecker.PasswordStrength strength = PasswordStrengthChecker.checkStrength(password);
                if (strength.getLevel() == PasswordStrengthChecker.StrengthLevel.WEAK) {
                    if (!PasswordManagerApp.getInstance().showConfirmation("弱密码警告",
                            "您设置的密码强度较弱，建议使用更强的密码。确定继续吗？")) {
                        return;
                    }
                }

                dbHelper.setMasterPassword(password);
                PasswordManagerApp.getInstance().setMasterPassword(password);
                PasswordManagerApp.getInstance().showMainView();
            } else {
                if (dbHelper.verifyMasterPassword(password)) {
                    PasswordManagerApp.getInstance().setMasterPassword(password);
                    PasswordManagerApp.getInstance().showMainView();
                } else {
                    showError("密码错误，请重试");
                    passwordField.clear();
                    passwordField.requestFocus();
                }
            }
        } catch (SQLException e) {
            showError("数据库错误: " + e.getMessage());
        }
    }

    private void showError(String message) {
        messageLabel.setText(message);
    }

    public Parent getView() {
        return root;
    }
}
