@echo off
echo.
echo === Decompiling and recompiling ===
md %1\orig >nul 2>nul
md %1\recomp >nul 2>nul
del %1\*.jack >nul 2>nul
node decomp %1
copy %1\*.vm %1\orig >nul 2>nul
del %1\*.vm >nul 2>nul
call ..\nand2tetris\tools\JackCompiler.bat %1
copy %1\*.vm %1\recomp >nul 2>nul
del %1\*.vm >nul 2>nul
copy %1\orig\*.vm %1\*.vm >nul 2>nul
echo === Comparing results ===
fc %1\orig\*.vm %1\recomp\*.vm
del %1\*.jack %1\orig\*.vm %1\recomp\*.vm >nul 2>nul
rd %1\orig >nul 2>nul
rd %1\recomp >nul 2>nul
echo.
