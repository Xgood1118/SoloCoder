@echo off
echo ====================================
echo   Image Management System - Start
echo ====================================

echo Starting backend server...
cd backend
start "IMS Backend" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8119 --reload"
cd ..

echo Starting frontend dev server...
cd frontend
start "IMS Frontend" cmd /k "npm run dev"
cd ..

echo.
echo Backend:  http://localhost:8119
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8119/docs
echo.
echo Press any key to exit (servers will keep running)...
pause >nul
