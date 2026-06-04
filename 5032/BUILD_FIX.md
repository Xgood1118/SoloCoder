# Android 日程管理应用 - 构建修复指南

## 问题描述
项目缺少 Gradle Wrapper 的核心文件，导致无法构建：
- ✅ `gradle/wrapper/gradle-wrapper.properties` (已存在)
- ❌ `gradle/wrapper/gradle-wrapper.jar` (缺失)
- ❌ `gradlew` / `gradlew.bat` (已创建)

---

## 快速修复方案（按推荐顺序）

### 方案一：使用 Android Studio（强烈推荐）

1. 打开 Android Studio
2. 选择 `File` → `Open`
3. 选择项目目录：`d:\work01\SoloCoder\5032`
4. Android Studio 会自动：
   - 下载缺失的 `gradle-wrapper.jar`
   - 配置 Gradle
   - 同步项目
   - 准备构建

5. 构建 APK：
   - 菜单：`Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - APK 输出位置：`app/build/outputs/apk/debug/app-debug.apk`

---

### 方案二：手动下载 gradle-wrapper.jar

#### Windows PowerShell:
```powershell
# 创建目录（如果不存在）
if (-not (Test-Path "gradle\wrapper")) {
    New-Item -ItemType Directory -Path "gradle\wrapper" -Force
}

# 从 Maven Central 下载
$url = "https://repo1.maven.org/maven2/org/gradle/gradle-wrapper/8.2/gradle-wrapper-8.2.jar"
$output = "gradle\wrapper\gradle-wrapper.jar"
Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing

# 验证文件
if (Test-Path $output) {
    Write-Host "下载成功！文件大小: $((Get-Item $output).Length) bytes"
} else {
    Write-Host "下载失败"
}
```

#### 手动下载步骤：
1. 访问：https://repo1.maven.org/maven2/org/gradle/gradle-wrapper/8.2/gradle-wrapper-8.2.jar
2. 保存到：`gradle\wrapper\gradle-wrapper.jar`
3. 运行构建：
   ```cmd
   gradlew.bat assembleDebug
   ```

---

### 方案三：安装 Gradle 后生成 Wrapper

1. 下载并安装 Gradle 8.2：
   - 访问：https://gradle.org/install/
   - 或使用包管理器：`choco install gradle` (Windows)

2. 在项目目录运行：
   ```cmd
   gradle wrapper --gradle-version 8.2
   ```

3. 然后构建：
   ```cmd
   gradlew.bat assembleDebug
   ```

---

### 方案四：从其他项目复制

如果你有其他正常工作的 Android/Gradle 项目：
1. 从那个项目复制 `gradle/wrapper/gradle-wrapper.jar`
2. 粘贴到本项目的 `gradle/wrapper/` 目录
3. 确保版本兼容（8.x 版本均可）

---

## 构建前检查清单

在运行构建前，确保：

1. ✅ **Java JDK 已安装** (版本 17+)
   ```cmd
   java -version
   ```

2. ✅ **Android SDK 已配置**
   - 创建 `local.properties` 文件
   - 添加：`sdk.dir=C:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk`
   - 或设置环境变量 `ANDROID_HOME`

3. ✅ **Gradle Wrapper 文件完整**
   ```
   project/
   ├── gradlew.bat          ✅ 已创建
   ├── gradlew              ✅ 已创建
   └── gradle/
       └── wrapper/
           ├── gradle-wrapper.properties   ✅ 已存在
           └── gradle-wrapper.jar          ❓ 需要
   ```

---

## 常见问题解决

### 问题 1：提示 "JAVA_HOME is not set"
**解决**：
```cmd
set JAVA_HOME=C:\Program Files\Java\jdk-17
set PATH=%JAVA_HOME%\bin;%PATH%
```

### 问题 2：Android SDK 未找到
**解决**：创建 `local.properties` 文件：
```properties
sdk.dir=C\:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
```

### 问题 3：网络问题无法下载 Gradle
**解决**：
1. 使用 Android Studio 的内置 Gradle
2. 或配置镜像源（如阿里云镜像）

---

## 项目文件结构

```
ScheduleManager/
├── app/
│   ├── src/main/
│   │   ├── java/com/example/schedulemanager/
│   │   │   ├── data/           # 数据层（Room DB）
│   │   │   ├── ui/             # 界面层
│   │   │   ├── reminder/       # 提醒功能
│   │   │   └── util/           # 工具类
│   │   ├── res/                # 资源文件
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── gradle/wrapper/
│   ├── gradle-wrapper.properties
│   └── gradle-wrapper.jar      ⚠️ 需要此文件！
├── build.gradle
├── settings.gradle
├── gradlew.bat                 ✅ 已创建
├── gradlew                     ✅ 已创建
└── setup-gradle.ps1            # PowerShell 安装脚本
```

---

## 验证构建成功

运行以下命令验证：

```cmd
# Windows
gradlew.bat --version

# 如果成功，会显示 Gradle 版本信息
gradlew.bat assembleDebug
```

成功后，APK 文件在：
```
app/build/outputs/apk/debug/app-debug.apk
```

---

## 仍然有问题？

1. 检查是否安装了 Android Studio（最简单的方案）
2. 确保有稳定的网络连接（首次构建需要下载依赖）
3. 检查防火墙是否阻止了下载
4. 尝试使用 Android Studio 的 "Sync Project with Gradle Files" 按钮
