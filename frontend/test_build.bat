@echo off
echo Running build and saving output to build_log.txt...
call npm run build > build_log.txt 2>&1
echo Done!
