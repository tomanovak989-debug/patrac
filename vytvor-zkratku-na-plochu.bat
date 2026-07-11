@echo off
set PROJECT=%~dp0
set PROJECT=%PROJECT:~0,-1%
set SHORTCUT=%USERPROFILE%\Desktop\PATRAC lokalne.lnk

powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%'); $s.TargetPath='%PROJECT%\start-local.bat'; $s.WorkingDirectory='%PROJECT%'; $s.IconLocation='shell32.dll,13'; $s.Description='PÁTRAČ — okamzity lokalni nahled'; $s.Save()"

echo Hotovo: zkratka "%SHORTCUT%"
pause
