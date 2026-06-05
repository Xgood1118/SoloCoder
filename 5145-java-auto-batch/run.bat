@echo off
set CP=target\classes
for %%f in (cp.txt) do (
  for /F "tokens=* delims=;" %%j in (cp.txt) do (
    set CP=!CP!;%%j
  )
)
java -cp "%CP%" com.etl.DataExtractCleanMain %*
