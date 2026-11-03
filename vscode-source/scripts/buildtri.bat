@echo off
setlocal

title BUILD TRI IDE Launcher
pushd %~dp0\..

:: Set Python environment
set "PYTHON=C:\Users\Admin\AppData\Local\Python\pythoncore-3.14-64\python.exe"
set "PATH=C:\Users\Admin\AppData\Local\Python\pythoncore-3.14-64;C:\Users\Admin\AppData\Local\Python\pythoncore-3.14-64\Scripts;%PATH%"
set "VSCODE_SKIP_NODE_VERSION_CHECK=1"

call scripts\code.bat %*

popd
endlocal
