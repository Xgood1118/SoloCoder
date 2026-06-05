# ----------------------------------------------------------------------------
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# ----------------------------------------------------------------------------

# ----------------------------------------------------------------------------
# Maven Wrapper PowerShell 启动脚本
# 如果系统中已安装 Maven 则直接使用，否则自动下载 Maven
# ----------------------------------------------------------------------------

$MAVEN_VERSION = "3.9.6"
$MAVEN_BASE_URL = "https://archive.apache.org/dist/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.zip"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$MAVEN_DIR = Join-Path $SCRIPT_DIR "maven-temp"
$MAVEN_HOME = Join-Path $MAVEN_DIR "apache-maven-$MAVEN_VERSION"

$localMvn = Get-Command mvn -ErrorAction SilentlyContinue

if ($localMvn) {
    Write-Host "[INFO] Using local Maven installation"
    & mvn $args
    exit $LASTEXITCODE
}

if (-not (Test-Path "$MAVEN_HOME\bin\mvn.cmd")) {
    Write-Host "[INFO] Downloading Maven $MAVEN_VERSION..."
    if (-not (Test-Path $MAVEN_DIR)) {
        New-Item -ItemType Directory -Path $MAVEN_DIR | Out-Null
    }
    $mavenZip = Join-Path $MAVEN_DIR "maven.zip"
    Invoke-WebRequest -Uri $MAVEN_BASE_URL -OutFile $mavenZip
    Write-Host "[INFO] Extracting Maven..."
    Expand-Archive -Path $mavenZip -DestinationPath $MAVEN_DIR
    Remove-Item $mavenZip
}

$env:PATH = "$MAVEN_HOME\bin;$env:PATH"
& "$MAVEN_HOME\bin\mvn.cmd" $args
exit $LASTEXITCODE
