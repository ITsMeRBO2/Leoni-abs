@echo off
echo ==========================================
echo Setup Backend - Leoni-abs
echo ==========================================

cd backend

echo.
echo [1/4] Creation de l'environnement virtuel...
python -m venv venv

echo.
echo [2/4] Installation des dependances...
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo [3/4] Creation des migrations...
python manage.py makemigrations api
python manage.py migrate

echo.
echo [4/4] Creation du super utilisateur (Admin)...
python manage.py createsuperuser

echo.
echo ==========================================
echo Backend configure avec succes !
echo ==========================================
echo Pour demarrer le serveur, executez :
echo cd backend
echo call venv\Scripts\activate.bat
echo python manage.py runserver
pause
