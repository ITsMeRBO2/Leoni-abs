from django.db import models
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('rh', 'RH'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='rh')

    def __str__(self):
        return f"{self.username} ({self.role})"


class Employee(models.Model):
    mle = models.CharField(max_length=50, primary_key=True)
    mle_2 = models.CharField(max_length=50, null=True, blank=True)
    nom_prenom = models.CharField(max_length=255)
    famille = models.CharField(max_length=100)
    seg = models.CharField(max_length=100)
    affectation = models.CharField(max_length=100)
    cc = models.CharField(max_length=100)
    contrat = models.CharField(max_length=100)
    consecutive_absences = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.nom_prenom} - {self.mle}"


class Attendance(models.Model):
    STATUT_CHOICES = (
        ('Present', 'Présent'),
        ('Absent', 'Absent'),
        ('Repos', 'Repos'),
        ('Ferie', 'Férié'),
    )
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    heure_entree = models.TimeField(null=True, blank=True)
    heure_sortie = models.TimeField(null=True, blank=True)
    heures_travaillees = models.FloatField(default=0.0)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES)

    class Meta:
        unique_together = ('employee', 'date')

    def __str__(self):
        return f"{self.employee.nom_prenom} - {self.date} - {self.statut}"


class Settings(models.Model):
    min_working_hours = models.FloatField(default=5.0)
    disabled_families = models.JSONField(default=list, blank=True)

    def save(self, *args, **kwargs):
        self.pk = 1  # Singleton
        super(Settings, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

class SaturdayConfiguration(models.Model):
    date = models.DateField(unique=True)
    families_off = models.JSONField(default=list)  # List of strings (families)

    def __str__(self):
        return f"Config {self.date}"


class Departure(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='departures')
    date_added = models.DateField(auto_now_add=True)
    absences_count = models.IntegerField()

    def __str__(self):
        return f"Departure: {self.employee.nom_prenom} on {self.date_added}"


class ImportHistory(models.Model):
    date_imported = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=50)
    records_processed = models.IntegerField(default=0)
    file_name = models.CharField(max_length=255)

    def __str__(self):
        return f"Import on {self.date_imported} - {self.status}"


class PublicHoliday(models.Model):
    date = models.DateField(unique=True)
    description = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.date} - {self.description or 'Jour Férié'}"
