package com.passwordmanager.ui;

import com.passwordmanager.PasswordManagerApp;
import com.passwordmanager.database.DatabaseHelper;
import com.passwordmanager.model.Category;
import com.passwordmanager.model.PasswordEntry;
import com.passwordmanager.service.ExportService;
import com.passwordmanager.service.LockService;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Parent;
import javafx.scene.control.*;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.*;
import javafx.stage.FileChooser;

import java.io.File;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

public class MainView {
    private BorderPane root;
    private DatabaseHelper dbHelper;
    private ExportService exportService;
    private LockService lockService;

    private ListView<Category> categoryListView;
    private TableView<PasswordEntry> passwordTable;
    private ObservableList<PasswordEntry> passwordList;
    private TextField searchField;
    private CheckBox exactMatchCheckBox;
    private Category selectedCategory;

    public MainView() {
        this.dbHelper = DatabaseHelper.getInstance();
        this.exportService = new ExportService();
        this.lockService = PasswordManagerApp.getInstance().getLockService();
        this.passwordList = FXCollections.observableArrayList();
        buildUI();
        loadCategories();
    }

    private void buildUI() {
        root = new BorderPane();

        VBox topBox = new VBox(10);
        topBox.setPadding(new Insets(10));
        topBox.getStyleClass().add("top-bar");

        MenuBar menuBar = createMenuBar();

        HBox searchBox = new HBox(10);
        searchBox.setAlignment(Pos.CENTER_LEFT);

        searchField = new TextField();
        searchField.setPromptText("搜索密码...");
        searchField.setPrefWidth(300);
        searchField.textProperty().addListener((obs, oldVal, newVal) -> performSearch());
        searchField.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ESCAPE) {
                searchField.clear();
            }
        });

        exactMatchCheckBox = new CheckBox("精确匹配");
        exactMatchCheckBox.selectedProperty().addListener((obs, oldVal, newVal) -> performSearch());

        Button addButton = new Button("添加密码");
        addButton.getStyleClass().add("primary-button");
        addButton.setOnAction(e -> showAddPasswordDialog());

        searchBox.getChildren().addAll(searchField, exactMatchCheckBox, addButton);

        topBox.getChildren().addAll(menuBar, searchBox);
        root.setTop(topBox);

        SplitPane splitPane = new SplitPane();
        splitPane.setDividerPositions(0.2);

        VBox categoryBox = new VBox(10);
        categoryBox.setPadding(new Insets(10));
        categoryBox.getStyleClass().add("sidebar");

        Label categoryLabel = new Label("分类");
        categoryLabel.getStyleClass().add("section-title");

        categoryListView = new ListView<>();
        categoryListView.getSelectionModel().selectedItemProperty().addListener((obs, oldVal, newVal) -> {
            selectedCategory = newVal;
            loadPasswords();
        });

        HBox categoryButtons = new HBox(5);
        Button addCatButton = new Button("+");
        Button editCatButton = new Button("编辑");
        Button deleteCatButton = new Button("-");

        addCatButton.setOnAction(e -> showAddCategoryDialog());
        editCatButton.setOnAction(e -> showEditCategoryDialog());
        deleteCatButton.setOnAction(e -> deleteSelectedCategory());

        categoryButtons.getChildren().addAll(addCatButton, editCatButton, deleteCatButton);

        VBox.setVgrow(categoryListView, Priority.ALWAYS);
        categoryBox.getChildren().addAll(categoryLabel, categoryListView, categoryButtons);

        VBox passwordBox = new VBox(10);
        passwordBox.setPadding(new Insets(10));

        Label passwordLabel = new Label("密码列表");
        passwordLabel.getStyleClass().add("section-title");

        passwordTable = new TableView<>(passwordList);
        passwordTable.getStyleClass().add("password-table");
        passwordTable.setRowFactory(tv -> {
            TableRow<PasswordEntry> row = new TableRow<>();
            ContextMenu contextMenu = createPasswordContextMenu();
            row.contextMenuProperty().bind(
                    javafx.beans.binding.Bindings.when(row.emptyProperty())
                            .then((ContextMenu) null)
                            .otherwise(contextMenu)
            );
            return row;
        });

        TableColumn<PasswordEntry, String> titleCol = new TableColumn<>("标题");
        titleCol.setCellValueFactory(new PropertyValueFactory<>("title"));
        titleCol.setPrefWidth(150);

        TableColumn<PasswordEntry, String> usernameCol = new TableColumn<>("用户名");
        usernameCol.setCellValueFactory(new PropertyValueFactory<>("username"));
        usernameCol.setPrefWidth(150);

        TableColumn<PasswordEntry, String> urlCol = new TableColumn<>("网址");
        urlCol.setCellValueFactory(new PropertyValueFactory<>("url"));
        urlCol.setPrefWidth(200);

        TableColumn<PasswordEntry, String> actionCol = new TableColumn<>("操作");
        actionCol.setPrefWidth(150);
        actionCol.setCellFactory(param -> new TableCell<>() {
            private final Button copyUserBtn = new Button("复制用户");
            private final Button copyPassBtn = new Button("复制密码");
            private final HBox pane = new HBox(5, copyUserBtn, copyPassBtn);

            {
                copyUserBtn.getStyleClass().add("small-button");
                copyPassBtn.getStyleClass().add("small-button");
                copyUserBtn.setOnAction(e -> {
                    PasswordEntry entry = getTableView().getItems().get(getIndex());
                    copyToClipboard(entry.getUsername());
                });
                copyPassBtn.setOnAction(e -> {
                    PasswordEntry entry = getTableView().getItems().get(getIndex());
                    copyPasswordToClipboard(entry);
                });
            }

            @Override
            protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                setGraphic(empty ? null : pane);
            }
        });

        passwordTable.getColumns().addAll(titleCol, usernameCol, urlCol, actionCol);
        passwordTable.setOnMouseClicked(e -> {
            if (e.getClickCount() == 2) {
                PasswordEntry selected = passwordTable.getSelectionModel().getSelectedItem();
                if (selected != null) {
                    showEditPasswordDialog(selected);
                }
            }
        });

        VBox.setVgrow(passwordTable, Priority.ALWAYS);
        passwordBox.getChildren().addAll(passwordLabel, passwordTable);

        splitPane.getItems().addAll(categoryBox, passwordBox);
        root.setCenter(splitPane);

        HBox statusBar = new HBox(10);
        statusBar.setPadding(new Insets(5, 10, 5, 10));
        statusBar.getStyleClass().add("status-bar");
        statusBar.setAlignment(Pos.CENTER_LEFT);

        Label statusLabel = new Label("就绪");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Button lockButton = new Button("锁定");
        lockButton.setOnAction(e -> lockService.lock());

        Button settingsButton = new Button("设置");
        settingsButton.setOnAction(e -> showSettingsDialog());

        statusBar.getChildren().addAll(statusLabel, spacer, settingsButton, lockButton);
        root.setBottom(statusBar);
    }

    private MenuBar createMenuBar() {
        MenuBar menuBar = new MenuBar();

        Menu fileMenu = new Menu("文件");
        MenuItem exportCsvItem = new MenuItem("导出CSV...");
        exportCsvItem.setOnAction(e -> exportToCsv());
        MenuItem exportBackupItem = new MenuItem("导出加密备份...");
        exportBackupItem.setOnAction(e -> exportToEncryptedBackup());
        MenuItem importBackupItem = new MenuItem("导入加密备份...");
        importBackupItem.setOnAction(e -> importFromEncryptedBackup());
        MenuItem exitItem = new MenuItem("退出");
        exitItem.setOnAction(e -> Platform.exit());
        fileMenu.getItems().addAll(exportCsvItem, exportBackupItem, importBackupItem, new SeparatorMenuItem(), exitItem);

        Menu editMenu = new Menu("编辑");
        MenuItem addPasswordItem = new MenuItem("添加密码");
        addPasswordItem.setOnAction(e -> showAddPasswordDialog());
        editMenu.getItems().add(addPasswordItem);

        Menu helpMenu = new Menu("帮助");
        MenuItem aboutItem = new MenuItem("关于");
        aboutItem.setOnAction(e -> showAboutDialog());
        helpMenu.getItems().add(aboutItem);

        menuBar.getMenus().addAll(fileMenu, editMenu, helpMenu);
        return menuBar;
    }

    private ContextMenu createPasswordContextMenu() {
        ContextMenu menu = new ContextMenu();
        MenuItem copyUserItem = new MenuItem("复制用户名");
        copyUserItem.setOnAction(e -> {
            PasswordEntry entry = passwordTable.getSelectionModel().getSelectedItem();
            if (entry != null) copyToClipboard(entry.getUsername());
        });
        MenuItem copyPassItem = new MenuItem("复制密码");
        copyPassItem.setOnAction(e -> {
            PasswordEntry entry = passwordTable.getSelectionModel().getSelectedItem();
            if (entry != null) copyPasswordToClipboard(entry);
        });
        MenuItem editItem = new MenuItem("编辑");
        editItem.setOnAction(e -> {
            PasswordEntry entry = passwordTable.getSelectionModel().getSelectedItem();
            if (entry != null) showEditPasswordDialog(entry);
        });
        MenuItem deleteItem = new MenuItem("删除");
        deleteItem.setOnAction(e -> {
            PasswordEntry entry = passwordTable.getSelectionModel().getSelectedItem();
            if (entry != null) deletePassword(entry);
        });
        menu.getItems().addAll(copyUserItem, copyPassItem, new SeparatorMenuItem(), editItem, deleteItem);
        return menu;
    }

    private void loadCategories() {
        try {
            List<Category> categories = dbHelper.getAllCategories();
            categoryListView.getItems().setAll(categories);
            if (!categories.isEmpty()) {
                categoryListView.getSelectionModel().select(0);
            }
        } catch (SQLException e) {
            PasswordManagerApp.getInstance().showError("加载分类失败", e.getMessage());
        }
    }

    private void loadPasswords() {
        try {
            List<PasswordEntry> passwords;
            if (selectedCategory != null && selectedCategory.getName().equals("全部")) {
                passwords = dbHelper.getPasswordsByCategory(-1);
            } else if (selectedCategory != null) {
                passwords = dbHelper.getPasswordsByCategory(selectedCategory.getId());
            } else {
                passwords = dbHelper.getPasswordsByCategory(-1);
            }
            passwordList.setAll(passwords);
        } catch (SQLException e) {
            PasswordManagerApp.getInstance().showError("加载密码失败", e.getMessage());
        }
    }

    private void performSearch() {
        String keyword = searchField.getText().trim();
        if (keyword.isEmpty()) {
            loadPasswords();
            return;
        }
        try {
            List<PasswordEntry> results = dbHelper.searchPasswords(keyword, exactMatchCheckBox.isSelected());
            passwordList.setAll(results);
        } catch (SQLException e) {
            PasswordManagerApp.getInstance().showError("搜索失败", e.getMessage());
        }
    }

    private void showAddCategoryDialog() {
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle("添加分类");
        dialog.setHeaderText("输入新分类名称");
        dialog.setContentText("名称:");
        dialog.initOwner(PasswordManagerApp.getInstance().getPrimaryStage());

        Optional<String> result = dialog.showAndWait();
        result.ifPresent(name -> {
            if (!name.trim().isEmpty()) {
                try {
                    Category cat = new Category();
                    cat.setName(name.trim());
                    cat.setSortOrder(categoryListView.getItems().size());
                    dbHelper.addCategory(cat);
                    loadCategories();
                } catch (SQLException e) {
                    PasswordManagerApp.getInstance().showError("添加分类失败", e.getMessage());
                }
            }
        });
    }

    private void showEditCategoryDialog() {
        Category cat = categoryListView.getSelectionModel().getSelectedItem();
        if (cat == null || cat.getName().equals("全部")) {
            return;
        }
        TextInputDialog dialog = new TextInputDialog(cat.getName());
        dialog.setTitle("编辑分类");
        dialog.setHeaderText("修改分类名称");
        dialog.setContentText("名称:");
        dialog.initOwner(PasswordManagerApp.getInstance().getPrimaryStage());

        Optional<String> result = dialog.showAndWait();
        result.ifPresent(name -> {
            if (!name.trim().isEmpty()) {
                try {
                    cat.setName(name.trim());
                    dbHelper.updateCategory(cat);
                    loadCategories();
                } catch (SQLException e) {
                    PasswordManagerApp.getInstance().showError("修改分类失败", e.getMessage());
                }
            }
        });
    }

    private void deleteSelectedCategory() {
        Category cat = categoryListView.getSelectionModel().getSelectedItem();
        if (cat == null || cat.getName().equals("全部")) {
            return;
        }
        if (PasswordManagerApp.getInstance().showConfirmation("删除分类",
                "确定要删除分类 \"" + cat.getName() + "\" 吗？该分类下的密码将变为未分类。")) {
            try {
                dbHelper.deleteCategory(cat.getId());
                loadCategories();
            } catch (SQLException e) {
                PasswordManagerApp.getInstance().showError("删除分类失败", e.getMessage());
            }
        }
    }

    private void showAddPasswordDialog() {
        PasswordEntry entry = new PasswordEntry();
        if (selectedCategory != null && !selectedCategory.getName().equals("全部")) {
            entry.setCategoryId(selectedCategory.getId());
        }
        PasswordDialog dialog = new PasswordDialog(entry, true);
        dialog.showAndWait().ifPresent(result -> {
            try {
                dbHelper.addPasswordEntry(result);
                loadPasswords();
            } catch (SQLException e) {
                PasswordManagerApp.getInstance().showError("添加密码失败", e.getMessage());
            }
        });
    }

    private void showEditPasswordDialog(PasswordEntry entry) {
        PasswordDialog dialog = new PasswordDialog(entry, false);
        dialog.showAndWait().ifPresent(result -> {
            try {
                dbHelper.updatePasswordEntry(result);
                loadPasswords();
            } catch (SQLException e) {
                PasswordManagerApp.getInstance().showError("修改密码失败", e.getMessage());
            }
        });
    }

    private void deletePassword(PasswordEntry entry) {
        if (PasswordManagerApp.getInstance().showConfirmation("删除密码",
                "确定要删除密码 \"" + entry.getTitle() + "\" 吗？此操作不可恢复。")) {
            try {
                dbHelper.deletePasswordEntry(entry.getId());
                loadPasswords();
            } catch (SQLException e) {
                PasswordManagerApp.getInstance().showError("删除密码失败", e.getMessage());
            }
        }
    }

    private void copyToClipboard(String text) {
        if (text != null && !text.isEmpty()) {
            javafx.scene.input.Clipboard clipboard = javafx.scene.input.Clipboard.getSystemClipboard();
            javafx.scene.input.ClipboardContent content = new javafx.scene.input.ClipboardContent();
            content.putString(text);
            clipboard.setContent(content);
        }
    }

    private void copyPasswordToClipboard(PasswordEntry entry) {
        try {
            String masterPassword = PasswordManagerApp.getInstance().getMasterPassword();
            String decrypted = com.passwordmanager.security.EncryptionUtil.decrypt(
                    entry.getEncryptedPassword(), masterPassword);
            copyToClipboard(decrypted);
        } catch (Exception e) {
            PasswordManagerApp.getInstance().showError("解密失败", e.getMessage());
        }
    }

    private void exportToCsv() {
        if (!PasswordManagerApp.getInstance().showConfirmation("导出警告",
                "警告：导出的CSV文件包含明文密码！请妥善保管，避免泄露。确定继续吗？")) {
            return;
        }
        FileChooser fileChooser = new FileChooser();
        fileChooser.setTitle("导出CSV");
        fileChooser.setInitialFileName("passwords.csv");
        fileChooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("CSV文件", "*.csv"));
        File file = fileChooser.showSaveDialog(PasswordManagerApp.getInstance().getPrimaryStage());
        if (file != null) {
            try {
                String masterPassword = PasswordManagerApp.getInstance().getMasterPassword();
                exportService.exportToCsv(file, masterPassword);
                PasswordManagerApp.getInstance().showInfo("导出成功", "密码已导出到: " + file.getAbsolutePath());
            } catch (Exception e) {
                PasswordManagerApp.getInstance().showError("导出失败", e.getMessage());
            }
        }
    }

    private void exportToEncryptedBackup() {
        FileChooser fileChooser = new FileChooser();
        fileChooser.setTitle("导出加密备份");
        fileChooser.setInitialFileName("passwords_backup.pm");
        fileChooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("密码管理器备份", "*.pm"));
        File file = fileChooser.showSaveDialog(PasswordManagerApp.getInstance().getPrimaryStage());
        if (file != null) {
            try {
                String masterPassword = PasswordManagerApp.getInstance().getMasterPassword();
                exportService.exportToEncryptedBackup(file, masterPassword);
                PasswordManagerApp.getInstance().showInfo("导出成功", "加密备份已保存到: " + file.getAbsolutePath());
            } catch (Exception e) {
                PasswordManagerApp.getInstance().showError("导出失败", e.getMessage());
            }
        }
    }

    private void importFromEncryptedBackup() {
        FileChooser fileChooser = new FileChooser();
        fileChooser.setTitle("导入加密备份");
        fileChooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("密码管理器备份", "*.pm"));
        File file = fileChooser.showOpenDialog(PasswordManagerApp.getInstance().getPrimaryStage());
        if (file != null) {
            try {
                String masterPassword = PasswordManagerApp.getInstance().getMasterPassword();
                exportService.importFromEncryptedBackup(file, masterPassword);
                loadCategories();
                loadPasswords();
                PasswordManagerApp.getInstance().showInfo("导入成功", "备份数据已导入");
            } catch (Exception e) {
                PasswordManagerApp.getInstance().showError("导入失败", "密码错误或文件损坏");
            }
        }
    }

    private void showSettingsDialog() {
        Dialog<Void> dialog = new Dialog<>();
        dialog.setTitle("设置");
        dialog.setHeaderText("应用设置");
        dialog.initOwner(PasswordManagerApp.getInstance().getPrimaryStage());

        ButtonType okButtonType = new ButtonType("确定", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(okButtonType, ButtonType.CANCEL);

        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.setPadding(new Insets(20, 150, 10, 10));

        Spinner<Integer> timeoutSpinner = new Spinner<>(1, 120, lockService.getLockTimeoutMinutes());
        timeoutSpinner.setEditable(true);

        grid.add(new Label("自动锁定时间(分钟):"), 0, 0);
        grid.add(timeoutSpinner, 1, 0);

        dialog.getDialogPane().setContent(grid);

        dialog.setResultConverter(dialogButton -> {
            if (dialogButton == okButtonType) {
                lockService.setLockTimeoutMinutes(timeoutSpinner.getValue());
            }
            return null;
        });

        dialog.showAndWait();
    }

    private void showAboutDialog() {
        Alert alert = new Alert(Alert.AlertType.INFORMATION);
        alert.setTitle("关于");
        alert.setHeaderText("本地密码管理器");
        alert.setContentText("版本: 1.0.0\n\n安全存储和管理您的密码");
        alert.initOwner(PasswordManagerApp.getInstance().getPrimaryStage());
        alert.showAndWait();
    }

    public Parent getView() {
        return root;
    }
}
