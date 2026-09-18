@echo off
REM Caminho curto do Windows (sem acento) para nao quebrar no agendador.
set PROJ=C:\Users\gabri\OneDrive\READET~1\GESTAO~1
cd /d "%PROJ%"
"C:\Program Files\nodejs\node.exe" "%PROJ%\scripts\backup-db.cjs" >> "%PROJ%\backups\backup-log.txt" 2>&1
