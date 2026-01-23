@echo off
echo Cleaning up Claude Code temporary directories...
echo This will delete all tmpclaude-* folders in the current directory.
echo.
pause

cd /d "%~dp0"

for /d %%i in (tmpclaude-*) do (
    echo Deleting %%i
    rd /s /q "%%i"
)

echo.
echo Cleanup complete!
pause
