# PowerShell script to download Gradle Wrapper JAR
# Run this script if gradle-wrapper.jar is missing

$ErrorActionPreference = "Stop"

$wrapperDir = Join-Path $PSScriptRoot "gradle\wrapper"
$jarPath = Join-Path $wrapperDir "gradle-wrapper.jar"
$jarUrl = "https://services.gradle.org/distributions/gradle-8.2-bin.zip"
$tempZip = Join-Path $env:TEMP "gradle-8.2-bin.zip"
$extractDir = Join-Path $env:TEMP "gradle-8.2"

Write-Host "Setting up Gradle Wrapper..." -ForegroundColor Cyan

if (Test-Path $jarPath) {
    Write-Host "gradle-wrapper.jar already exists. Skipping download." -ForegroundColor Green
    exit 0
}

Write-Host "Downloading Gradle 8.2..." -ForegroundColor Yellow
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri $jarUrl -OutFile $tempZip -UseBasicParsing
$ProgressPreference = 'Continue'

Write-Host "Extracting Gradle..." -ForegroundColor Yellow
if (Test-Path $extractDir) {
    Remove-Item -Path $extractDir -Recurse -Force
}
Expand-Archive -Path $tempZip -DestinationPath $env:TEMP -Force

Write-Host "Copying gradle-wrapper.jar..." -ForegroundColor Yellow
$sourceJar = Join-Path $extractDir "lib\gradle-wrapper-8.2.jar"
if (-not (Test-Path $sourceJar)) {
    Write-Host "Looking for wrapper jar in different location..." -ForegroundColor Yellow
    $sourceJar = Get-ChildItem -Path $extractDir -Filter "gradle-wrapper*.jar" -Recurse | Select-Object -First 1 -ExpandProperty FullName
}

if ($sourceJar -and (Test-Path $sourceJar)) {
    if (-not (Test-Path $wrapperDir)) {
        New-Item -ItemType Directory -Path $wrapperDir -Force | Out-Null
    }
    Copy-Item -Path $sourceJar -Destination $jarPath -Force
    Write-Host "Success! gradle-wrapper.jar has been installed." -ForegroundColor Green
} else {
    Write-Host "Could not find gradle-wrapper.jar in the distribution. Trying alternative method..." -ForegroundColor Yellow
    $altUrl = "https://raw.githubusercontent.com/gradle/gradle/v8.2.0/gradle/wrapper/gradle-wrapper.jar"
    try {
        Invoke-WebRequest -Uri $altUrl -OutFile $jarPath -UseBasicParsing
        Write-Host "Success! gradle-wrapper.jar has been installed." -ForegroundColor Green
    } catch {
        Write-Host "Failed to download gradle-wrapper.jar. Please install Gradle manually and run: gradle wrapper" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Cleaning up temporary files..." -ForegroundColor Gray
Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
Remove-Item -Path $extractDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Setup complete! You can now run: .\gradlew.bat assembleDebug" -ForegroundColor Green
