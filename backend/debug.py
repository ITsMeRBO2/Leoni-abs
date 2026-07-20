import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from api.models import Attendance, Employee
from django.db.models import Max, Count

max_date = Attendance.objects.aggregate(max_date=Max('date'))['max_date']
count_max = Attendance.objects.filter(date=max_date).count() if max_date else 0
emp_count = Employee.objects.count()
today_count = Attendance.objects.filter(date='2026-07-09').count()

with open('debug_output.txt', 'w') as f:
    f.write(f"Max date: {max_date}\n")
    f.write(f"Count at max date: {count_max}\n")
    f.write(f"Total Employees: {emp_count}\n")
    f.write(f"Count today: {today_count}\n")

print("Done")
