@echo off
echo ========================================
echo 仓库管理系统 - 后端启动脚本 (开发模式)
echo ========================================
echo.
echo 正在启动后端服务，使用 H2 内嵌数据库...
echo 后端地址: http://localhost:8080
echo H2控制台: http://localhost:8080/h2-console
echo 默认账号: admin / 123456
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

cd /d "%~dp0backend\target\work"

java -cp ".;BOOT-INF/classes;BOOT-INF/lib/*" com.wms.WmsApplication ^
  --spring.profiles.active=dev ^
  "--spring.datasource.url=jdbc:h2:mem:wms_db;DB_CLOSE_DELAY=-1;MODE=MySQL;DATABASE_TO_LOWER=TRUE" ^
  --spring.datasource.driver-class-name=org.h2.Driver ^
  --spring.datasource.username=sa ^
  --spring.datasource.password= ^
  --spring.jpa.hibernate.ddl-auto=create-drop ^
  --spring.sql.init.mode=never ^
  --spring.h2.console.enabled=true ^
  --server.port=8080

pause
