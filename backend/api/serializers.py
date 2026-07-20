from rest_framework import serializers
from .models import CustomUser, Employee, Attendance, Settings, SaturdayConfiguration, Departure, ImportHistory, PublicHoliday

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role']

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'

class AttendanceSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)
    class Meta:
        model = Attendance
        fields = '__all__'

class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settings
        fields = ['min_working_hours', 'disabled_families']

class SaturdayConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaturdayConfiguration
        fields = '__all__'

class DepartureSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)
    class Meta:
        model = Departure
        fields = '__all__'

class ImportHistorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = ImportHistory
        fields = '__all__'

class PublicHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicHoliday
        fields = '__all__'
