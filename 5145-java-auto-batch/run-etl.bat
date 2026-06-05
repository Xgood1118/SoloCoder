@echo off
setlocal enabledelayedexpansion
set CP=target\classes
for /F "tokens=* delims=;" %%i in (cp.txt) do (
  set CP=!CP!;%%i
)
echo CP=!CP!> cp-debug.txt
type cp-debug.txt
