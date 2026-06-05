package com.passwordmanager;

import com.passwordmanager.database.DatabaseHelper;
import com.passwordmanager.ui.LoginView;
import com.passwordmanager.ui.MainView;
import com.passwordmanager.service.LockService;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.stage.Stage;
import javafx.stage.WindowEvent;

public class PasswordManagerApp extends Application {
    private static PasswordManagerApp instance;
    private Stage primaryStage;
    private String masterPassword;
    private LockService lockService;

    @Override
    public void start(Stage primaryStage) {
        this.primaryStage = primaryStage;
        this.instance = this;
        this.lockService = new LockService();

        lockService.setOnLockCallback(this::showLockScreen);

        try {
            DatabaseHelper dbHelper = DatabaseHelper.getInstance();
            dbHelper.initializeDatabase();

            primaryStage.setTitle("本地密码管理器");
            primaryStage.setWidth(900);
            primaryStage.setHeight(650);
            primaryStage.setMinWidth(800);
            primaryStage.setMinHeight(550);

            primaryStage.addEventFilter(javafx.scene.input.InputEvent.ANY, event -> {
                if (lockService.isLocked()) {
                    return;
                }
                lockService.updateActivity();
            });

            primaryStage.setOnCloseRequest(event -> {
                lockService.shutdown();
                try {
                    DatabaseHelper.getInstance().close();
                } catch (Exception e) {
                }
                Platform.exit();
            });

            showLoginView();

            primaryStage.show();

        } catch (Exception e) {
            showError("启动错误", "应用启动失败: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public static PasswordManagerApp getInstance() {
        return instance;
    }

    public Stage getPrimaryStage() {
        return primaryStage;
    }

    public String getMasterPassword() {
        return masterPassword;
    }

    public void setMasterPassword(String masterPassword) {
        this.masterPassword = masterPassword;
    }

    public LockService getLockService() {
        return lockService;
    }

    public void showLoginView() {
        LoginView loginView = new LoginView();
        Scene scene = new Scene(loginView.getView());
        scene.getStylesheets().add(getClass().getResource("/styles.css").toExternalForm());
        primaryStage.setScene(scene);
    }

    public void showMainView() {
        lockService.unlock();
        MainView mainView = new MainView();
        Scene scene = new Scene(mainView.getView());
        scene.getStylesheets().add(getClass().getResource("/styles.css").toExternalForm());
        primaryStage.setScene(scene);
    }

    private void showLockScreen() {
        Platform.runLater(() -> {
            masterPassword = null;
            showLoginView();
        });
    }

    public void showError(String title, String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(message);
        alert.initOwner(primaryStage);
        alert.showAndWait();
    }

    public void showInfo(String title, String message) {
        Alert alert = new Alert(Alert.AlertType.INFORMATION);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(message);
        alert.initOwner(primaryStage);
        alert.showAndWait();
    }

    public boolean showConfirmation(String title, String message) {
        Alert alert = new Alert(Alert.AlertType.CONFIRMATION);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(message);
        alert.initOwner(primaryStage);
        return alert.showAndWait().filter(response -> response == javafx.scene.control.ButtonType.OK).isPresent();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
