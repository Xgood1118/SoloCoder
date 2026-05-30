@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.
@REM ----------------------------------------------------------------------------

@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0..
set WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar"
set WRAPPER_PROPERTIES="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties"

if exist %WRAPPER_JAR% goto execute
echo Downloading Maven Wrapper...
goto fail

:execute
set MAVEN_CMD_LINE_ARGS=%*
set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain
%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar %MAVEN_CMD_LINE_ARGS%

:fail
exit /b 1
