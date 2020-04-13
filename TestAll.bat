@echo off
call .\TestDecomp.bat Tests\Average
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\ComplexArrays
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\ConvertToBin
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\FibonacciElement
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\Fraction
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\HelloWorld
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\List
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\OS
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\Pong
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\Seven
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\SimpleFunction
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\Square
if %errorlevel% neq 0 goto fail
echo PASS
call .\TestDecomp.bat Tests\StaticsTest
if %errorlevel% neq 0 goto fail
echo PASS

echo =============================
echo All tests passed successfuly.
echo =============================
goto end

:fail
echo ###################
echo ### Test FAILED ###
echo ###################

:end
