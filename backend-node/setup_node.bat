@echo off
echo Installing Node.js dependencies...
call npm install

echo Generating Prisma client...
call npx prisma generate

echo Compilation TypeScript...
call npm run build

echo.
echo Setup completed! To start the development server, run:
echo cd backend-node
echo npm run dev
pause
