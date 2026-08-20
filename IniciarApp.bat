@echo off
title Mi Contabilidad
echo Iniciando backend (NestJS) y frontend (Next.js)...
start "API - NestJS" cmd /k "cd /d %~dp0backend && npm run start:prod"
timeout /t 3 /nobreak >nul
start "Web - Next.js" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5 /nobreak >nul
start http://localhost:3000
echo Listo. La app se abre en http://localhost:3000
