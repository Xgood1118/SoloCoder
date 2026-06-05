@echo off
setlocal

set "MAVEN_VERSION=3.9.6"
set "MAVEN_BASE_URL=https://archive.apache.org/dist/maven/maven-3/%MAVEN_VERSION%/binaries/apache-maven-%MAVEN_VERSION%-bin.zip"
set "MAVEN_DIR=%~dp0maven-temp"
set "MAVEN_HOME=%MAVEN_DIR%\apache-maven-%MAVEN_VERSION%"

if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
    echo [INFO] Downloading Maven %MAVEN_VERSION%...
    if not exist "%MAVEN_DIR%" mkdir "%MAVEN_DIR%"
    powershell -Command "Invoke-WebRequest -Uri '%MAVEN_BASE_URL%' -OutFile '%MAVEN_DIR%\maven.zip'"
    echo [INFO] Extracting Maven...
    powershell -Command "Expand-Archive -Path '%MAVEN_DIR%\maven.zip' -DestinationPath '%MAVEN_DIR%'"
    del "%MAVEN_DIR%\maven.zip"
)

set "PATH=%MAVEN_HOME%\bin;%PATH%"
echo [INFO] Running mvn %*
call "%MAVEN_HOME%\bin\mvn.cmd" %*
