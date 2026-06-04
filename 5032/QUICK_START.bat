@echo off
echo ========================================
echo   Android 日程管理应用 - 快速启动
echo ========================================
echo.

REM Check if gradle-wrapper.jar exists
if exist "gradle\wrapper\gradle-wrapper.jar" (
    echo [OK] gradle-wrapper.jar 已存在
) else (
    echo [WARNING] gradle-wrapper.jar 缺失！
    echo.
    echo 请选择以下方案之一：
    echo.
    echo 方案 1: 使用 Android Studio 打开项目（推荐）
    echo    - Android Studio 会自动下载所有必需文件
    echo.
    echo 方案 2: 运行 PowerShell 脚本尝试下载
    echo    - 右键点击 setup-gradle.ps1
    echo    - 选择 "使用 PowerShell 运行"
    echo.
    echo 方案 3: 手动下载
    echo    - 访问: https://repo1.maven.org/maven2/org/gradle/gradle-wrapper/8.2/gradle-wrapper-8.2.jar
    echo    - 保存到: gradle\wrapper\gradle-wrapper.jar
    echo.
    pause
    exit /b 1
)

echo.
echo 检查 Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 Java，请安装 JDK 17+
    pause
    exit /b 1
) else (
    echo [OK] Java 已安装
)

echo.
echo ========================================
echo   准备就绪！
echo ========================================
echo.
echo 构建 Debug APK:
echo   gradlew.bat assembleDebug
echo.
echo 查看 Gradle 版本:
echo   gradlew.bat --version
echo.
echo 清理项目:
echo   gradlew.bat clean
echo.
echo 详细说明请查看 BUILD_FIX.md
echo.
pause
