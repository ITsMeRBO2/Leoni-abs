from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    EmployeeViewSet, AttendanceViewSet, DashboardView, DashboardWeeklyView, DashboardDailyView,
    UploadExcelView, DepartureViewSet, SettingsView, SaturdayConfigViewSet, PublicHolidayViewSet, DebugView, FamiliesListView
)
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'departures', DepartureViewSet, basename='departure')
router.register(r'saturday-config', SaturdayConfigViewSet, basename='saturday-config')
router.register(r'public-holidays', PublicHolidayViewSet, basename='public-holiday')

urlpatterns = [
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('dashboard/weekly/', DashboardWeeklyView.as_view(), name='dashboard_weekly'),
    path('dashboard/daily/', DashboardDailyView.as_view(), name='dashboard_daily'),
    path('imports/upload/', UploadExcelView.as_view(), name='upload_excel'),
    path('settings/', SettingsView.as_view(), name='settings'),
    path('families/', FamiliesListView.as_view(), name='families'),
    path('debug/', DebugView.as_view(), name='debug'),
]

urlpatterns += router.urls
