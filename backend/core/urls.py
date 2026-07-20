from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include

urlpatterns = [
    path('', lambda request: HttpResponse('Leoni API is running', content_type='text/plain')),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
