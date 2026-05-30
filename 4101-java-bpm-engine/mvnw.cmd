@REM ----------------------------------------------------------------------------
@REM Apache Maven Wrapper startup batch script, version 3.2.0
@REM ----------------------------------------------------------------------------

@SET MAVEN_PROJECTBASEDIR=%~dp0

@REM Find java.exe
@SET JAVA_EXE=java.exe
@IF DEFINED JAVA_HOME (
    @SET JAVA_HOME=%JAVA_HOME:"=%
    @SET JAVA_EXE=%JAVA_HOME%/bin/java.exe
)

@REM Execute Maven wrapper
@"%JAVA_EXE%" ^
    -classpath "%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar" ^
    org.apache.maven.wrapper.MavenWrapperMain %*

@if ERRORLEVEL 1 goto error
goto end

:error
echo Error: Maven execution failed.
exit /b 1

:end
