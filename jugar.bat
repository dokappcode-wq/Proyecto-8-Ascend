@echo off
rem Doble clic para jugar: actualiza, instala dependencias y abre ASCEND en el navegador.
cd /d "%~dp0"
git pull
call npm install
call npm start
