@echo off
md %1\orig
md %1\recomp
del %1\*.jack
node decomp %1
copy %1\*.vm %1\orig
del %1\*.vm
call ..\nand2tetris\tools\JackCompiler.bat %1
copy %1\*.vm %1\recomp
del %1\*.vm
copy %1\orig\*.vm %1\*.vm
echo === Comparing results ===
fc %1\orig\*.vm %1\recomp\*.vm
del %1\*.jack %1\orig\*.vm %1\recomp\*.vm
rd %1\orig
rd %1\recomp
