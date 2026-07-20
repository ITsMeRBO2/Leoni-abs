from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Employee, Attendance, Settings, SaturdayConfiguration, Departure, ImportHistory

admin.site.register(CustomUser, UserAdmin)
admin.site.register(Employee)
admin.site.register(Attendance)
admin.site.register(Settings)
admin.site.register(SaturdayConfiguration)
admin.site.register(Departure)
admin.site.register(ImportHistory)
