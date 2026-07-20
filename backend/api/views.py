from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.db.models import Count, Q, Max
from django.db import transaction
from django.http import HttpResponse
import pandas as pd
import io
from datetime import datetime, timedelta, date
import json

from .models import Employee, Attendance, Settings, SaturdayConfiguration, Departure, ImportHistory, PublicHoliday

class DebugView(APIView):
    permission_classes = []

    def get(self, request):
        today = date.today()
        latest_date = Attendance.objects.filter(date__lte=today).aggregate(max_date=Max('date'))['max_date']
        latest_date_any = Attendance.objects.aggregate(max_date=Max('date'))['max_date']
        
        return Response({
            'today': today,
            'latest_date_lte_today': latest_date,
            'latest_date_any': latest_date_any,
            'count_latest_lte': Attendance.objects.filter(date=latest_date).count() if latest_date else 0,
            'count_latest_any': Attendance.objects.filter(date=latest_date_any).count() if latest_date_any else 0,
            'count_today': Attendance.objects.filter(date=today).count(),
            'present_today': Attendance.objects.filter(date=today, statut='Present').count(),
            'absent_today': Attendance.objects.filter(date=today, statut='Absent').count(),
            'employee_count': Employee.objects.count()
        })
from .serializers import (
    EmployeeSerializer, AttendanceSerializer, SettingsSerializer, 
    SaturdayConfigurationSerializer, DepartureSerializer, PublicHolidaySerializer
)

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

    @action(detail=False, methods=['post'])
    def force_absences(self, request):
        mle = request.data.get('mle', '').strip()
        absences = request.data.get('absences')
        if not mle or absences is None:
            return Response({'error': 'MLE et nombre d\'absences sont requis.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Try exact match first
            try:
                employee = Employee.objects.get(mle=mle)
            except Employee.DoesNotExist:
                # Try case-insensitive match
                employee = Employee.objects.get(mle__iexact=mle)
            
            employee.consecutive_absences = int(absences)
            employee.save()
            
            if employee.consecutive_absences >= 4:
                Departure.objects.update_or_create(
                    employee=employee,
                    defaults={'absences_count': employee.consecutive_absences}
                )
            else:
                Departure.objects.filter(employee=employee).delete()
                
            return Response({'message': f'Absences consécutives mises à jour à {absences} pour l\'employé {employee.mle} ({employee.nom_prenom}).'})
        except Employee.DoesNotExist:
            return Response({'error': 'Employé introuvable avec ce MLE.'}, status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response({'error': 'Le nombre d\'absences doit être un nombre valide.'}, status=status.HTTP_400_BAD_REQUEST)

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        date_param = self.request.query_params.get('date')
        if date_param:
            queryset = queryset.filter(date=date_param)
        return queryset

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"error": "No IDs provided"}, status=status.HTTP_400_BAD_REQUEST)
        emp_ids = Attendance.objects.filter(id__in=ids).values_list('employee_id', flat=True)
        Employee.objects.filter(mle__in=emp_ids).delete()
        return Response({"message": "Deleted successfully"})

    @action(detail=False, methods=['post'])
    def manual_create(self, request):
        data = request.data
        employee, _ = Employee.objects.get_or_create(
            mle=data.get('mle'),
            defaults={
                'mle_2': data.get('mle_2', ''),
                'nom_prenom': data.get('nom_prenom', ''),
                'famille': data.get('famille', ''),
                'seg': data.get('seg', ''),
                'affectation': data.get('affectation', ''),
                'cc': data.get('cc', ''),
                'contrat': data.get('contrat', '')
            }
        )
        employee.nom_prenom = data.get('nom_prenom', employee.nom_prenom)
        employee.famille = data.get('famille', employee.famille)
        employee.affectation = data.get('affectation', employee.affectation)
        employee.contrat = data.get('contrat', employee.contrat)
        employee.save()
        
        att, _ = Attendance.objects.update_or_create(
            employee=employee,
            date=data.get('date'),
            defaults={
                'statut': data.get('statut', 'Absent'),
                'heures_travaillees': 0
            }
        )
        return Response(AttendanceSerializer(att).data)
        
    @action(detail=True, methods=['put'])
    def manual_update(self, request, pk=None):
        att = self.get_object()
        data = request.data
        employee = att.employee
        employee.nom_prenom = data.get('nom_prenom', employee.nom_prenom)
        employee.famille = data.get('famille', employee.famille)
        employee.affectation = data.get('affectation', employee.affectation)
        employee.contrat = data.get('contrat', employee.contrat)
        employee.save()
        
        if 'statut' in data:
            att.statut = data['statut']
            att.save()
            
        return Response(AttendanceSerializer(att).data)

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        queryset = self.get_queryset()
        data = []
        for att in queryset:
            data.append({
                'Date': att.date,
                'MLE': att.employee.mle,
                'MLE (Court)': att.employee.mle_2,
                'Nom & Prénom': att.employee.nom_prenom,
                'Famille': att.employee.famille,
                'SEG': att.employee.seg,
                'Affectation': att.employee.affectation,
                'CC': att.employee.cc,
                'Contrat': att.employee.contrat,
                'Heures': att.heures_travaillees,
                'Statut': att.statut,
            })
        df = pd.DataFrame(data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Absences')
            
        output.seek(0)
        response = HttpResponse(
            output.read(), 
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="Export_Absences.xlsx"'
        return response

class DepartureViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Departure.objects.all()
    serializer_class = DepartureSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        date_param = self.request.query_params.get('date')
        if date_param:
            queryset = queryset.filter(date_added=date_param)
        return queryset

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"error": "No IDs provided"}, status=status.HTTP_400_BAD_REQUEST)
        emp_ids = Departure.objects.filter(id__in=ids).values_list('employee_id', flat=True)
        Employee.objects.filter(mle__in=emp_ids).delete()
        return Response({"message": "Deleted successfully"})

    @action(detail=False, methods=['post'])
    def reset_absences(self, request):
        """Reset consecutive absences counter for selected departures and remove them from the list."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"error": "No IDs provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        departures = Departure.objects.filter(id__in=ids).select_related('employee')
        reset_count = 0
        for dep in departures:
            emp = dep.employee
            emp.consecutive_absences = 0
            emp.save()
            dep.delete()
            reset_count += 1
        
        return Response({"message": f"{reset_count} employé(s) réinitialisé(s) avec succès"})

    @action(detail=False, methods=['post'])
    def reset_all_absences(self, request):
        """Reset absences for ALL employees in the database."""
        # Reset consecutive absences to 0 for all employees
        reset_count = Employee.objects.all().update(consecutive_absences=0)
        # Delete all departure records
        Departure.objects.all().delete()
        
        return Response({"message": f"{reset_count} employé(s) réinitialisé(s) avec succès"})

    @action(detail=False, methods=['post'])
    def manual_create(self, request):
        data = request.data
        employee, _ = Employee.objects.get_or_create(
            mle=data.get('mle'),
            defaults={
                'nom_prenom': data.get('nom_prenom', ''),
                'famille': data.get('famille', ''),
                'affectation': data.get('affectation', ''),
                'contrat': data.get('contrat', '')
            }
        )
        employee.nom_prenom = data.get('nom_prenom', employee.nom_prenom)
        employee.famille = data.get('famille', employee.famille)
        employee.affectation = data.get('affectation', employee.affectation)
        employee.contrat = data.get('contrat', employee.contrat)
        employee.consecutive_absences = 4
        employee.save()
        
        dep, created = Departure.objects.get_or_create(
            employee=employee,
            defaults={
                'absences_count': employee.consecutive_absences
            }
        )
        if created and 'date' in data:
            Departure.objects.filter(id=dep.id).update(date_added=data['date'])
            dep.refresh_from_db()
            
        return Response(DepartureSerializer(dep).data)

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        queryset = self.get_queryset()
        data = []
        for dep in queryset:
            data.append({
                'Date d\'entrée': dep.date_added,
                'MLE': dep.employee.mle,
                'Nom & Prénom': dep.employee.nom_prenom,
                'Famille': dep.employee.famille,
                'Affectation': dep.employee.affectation,
                'Contrat': dep.employee.contrat,
                'Absences Consécutives': dep.absences_count,
            })
        df = pd.DataFrame(data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Departs')
            
        output.seek(0)
        response = HttpResponse(
            output.read(), 
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="Export_Departs.xlsx"'
        return response

class SaturdayConfigViewSet(viewsets.ModelViewSet):
    queryset = SaturdayConfiguration.objects.all()
    serializer_class = SaturdayConfigurationSerializer

class PublicHolidayViewSet(viewsets.ModelViewSet):
    queryset = PublicHoliday.objects.all().order_by('-date')
    serializer_class = PublicHolidaySerializer

class SettingsView(APIView):
    def get(self, request):
        settings = Settings.load()
        serializer = SettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        settings = Settings.load()
        serializer = SettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FamiliesListView(APIView):
    def get(self, request):
        all_families = Employee.objects.exclude(famille='').values_list('famille', flat=True).distinct()
        settings = Settings.load()
        disabled = settings.disabled_families or []
        families_data = [{'famille': f, 'enabled': f not in disabled} for f in all_families]
        return Response(families_data)

class DashboardView(APIView):
    def get(self, request):
        today = date.today()
        # Use the most recently imported date (ignoring today filter so future-dated imports are included)
        latest_date = Attendance.objects.aggregate(max_date=Max('date'))['max_date']
        
        # Load disabled families from settings
        _settings = Settings.load()
        disabled_families = _settings.disabled_families or []
        
        total_employees = Attendance.objects.filter(date=latest_date).exclude(employee__famille__in=disabled_families).count() if latest_date else 0
        present_today = Attendance.objects.filter(date=today, statut='Present').exclude(employee__famille__in=disabled_families).count()
        absent_today = Attendance.objects.filter(date=today, statut='Absent').exclude(employee__famille__in=disabled_families).count()
        total_departures = Departure.objects.exclude(employee__famille__in=disabled_families).count()
        
        # All absent families (excluding disabled ones)
        all_absent_families = Attendance.objects.filter(statut='Absent').exclude(employee__famille__in=disabled_families).values('employee__famille').annotate(
            total_absences=Count('id')
        ).order_by('-total_absences')
        
        # Top 4 absent families for alerts
        top_absent_families = all_absent_families[:4]
        
        # Get requested year, default to current year
        target_year = request.query_params.get('year')
        statut_filter = request.query_params.get('statut', 'Absent')
        if target_year:
            try:
                curr_year = int(target_year)
            except ValueError:
                curr_year = today.year
        else:
            curr_year = today.year

        months_data = []
        french_months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        for month in range(1, 13):
            months_data.append({'year': curr_year, 'month': month, 'name': french_months[month-1]})

        monthly_absences_table = []
        monthly_departures_table = []
        family_effectifs = []
        # disabled_families already loaded above from _settings
        families = Employee.objects.exclude(famille='').exclude(famille__in=disabled_families).values_list('famille', flat=True).distinct()
        for fam in families:
            row = {'famille': fam}
            dep_row = {'famille': fam}
            total_target = 0
            total_deps = 0
            total_effectif = 0
            
            # On conserve cette valeur pour le tableau family_effectifs (utilisé ailleurs)
            fam_total_employees = Attendance.objects.filter(employee__famille=fam, date=latest_date).count() if latest_date else 0
            
            family_effectifs.append({
                'famille': fam,
                'effectif': fam_total_employees
            })
            
            for m in months_data:
                base_qs = Attendance.objects.filter(
                    employee__famille=fam, 
                    date__year=m['year'],
                    date__month=m['month']
                )
                count = base_qs.filter(statut=statut_filter).count()
                row[m['name']] = count
                total_target += count
                total_effectif += base_qs.count()
                
                dep_count = Departure.objects.filter(
                    employee__famille=fam,
                    date_added__year=m['year'],
                    date_added__month=m['month']
                ).count()
                dep_row[m['name']] = dep_count
                total_deps += dep_count
                
            row['taux'] = round((total_target / total_effectif), 2) if total_effectif > 0 else 0
            dep_row['taux'] = round((total_deps / total_effectif), 2) if total_effectif > 0 else 0
            
            monthly_absences_table.append(row)
            monthly_departures_table.append(dep_row)
        
        # Build absences_by_family from ALL active families (including those with 0 absences)
        # so that re-enabled families always appear in the chart
        absences_count_map = {
            item['employee__famille']: item['total_absences'] 
            for item in all_absent_families
        }
        all_active_families = list(Employee.objects.exclude(famille='').exclude(famille__in=disabled_families).values_list('famille', flat=True).distinct())
        absences_by_family_full = sorted(
            [{'employee__famille': f, 'total_absences': absences_count_map.get(f, 0)} for f in all_active_families],
            key=lambda x: x['total_absences'], reverse=True
        )
        
        # Chart data
        chart_data = {
            "absences_by_family": absences_by_family_full,
            "monthly_absences_table": monthly_absences_table,
            "monthly_departures_table": monthly_departures_table,
            "months_columns": [m['name'] for m in months_data]
        }

        return Response({
            "total_employees": total_employees,
            "present_today": present_today,
            "absent_today": absent_today,
            "total_departures": total_departures,
            "top_absent_families": top_absent_families,
            "all_families_absences": all_absent_families,
            "family_effectifs": family_effectifs,
            "charts": chart_data
        })

class DashboardWeeklyView(APIView):
    def get(self, request):
        year = int(request.query_params.get('year', datetime.now().year))
        month = int(request.query_params.get('month', datetime.now().month))
        statut_filter = request.query_params.get('statut', 'Absent')
        import calendar
        _, last_day = calendar.monthrange(year, month)
        
        # Générer dynamiquement les semaines par blocs de 7 jours :
        # Sem 1: 1-7, Sem 2: 8-14, Sem 3: 15-21, Sem 4: 22-28, Sem 5: 29-fin (si existe)
        weeks = []
        week_num = 1
        start = 1
        while start <= last_day:
            end = min(start + 6, last_day)
            weeks.append({'name': f'Semaine {week_num}', 'start': start, 'end': end})
            week_num += 1
            start += 7
            
        weekly_absences_table = []
        weekly_departures_table = []
        settings = Settings.load()
        disabled_families = settings.disabled_families or []
        families = Employee.objects.exclude(famille='').exclude(famille__in=disabled_families).values_list('famille', flat=True).distinct()
        today = date.today()
        latest_date = Attendance.objects.aggregate(max_date=Max('date'))['max_date']
        
        for fam in families:
            row = {'famille': fam}
            dep_row = {'famille': fam}
            total_target = 0
            total_deps = 0
            total_effectif = 0
            
            for w in weeks:
                base_qs = Attendance.objects.filter(
                    employee__famille=fam,
                    date__year=year,
                    date__month=month,
                    date__day__gte=w['start'],
                    date__day__lte=w['end']
                )
                count = base_qs.filter(statut=statut_filter).count()
                row[w['name']] = count
                total_target += count
                total_effectif += base_qs.count()
                
                dep_count = Departure.objects.filter(
                    employee__famille=fam,
                    date_added__year=year,
                    date_added__month=month,
                    date_added__day__gte=w['start'],
                    date_added__day__lte=w['end']
                ).count()
                dep_row[w['name']] = dep_count
                total_deps += dep_count
                
            row['taux'] = round((total_target / total_effectif), 2) if total_effectif > 0 else 0
            dep_row['taux'] = round((total_deps / total_effectif), 2) if total_effectif > 0 else 0
            
            weekly_absences_table.append(row)
            weekly_departures_table.append(dep_row)
            
        return Response({
            "weekly_absences_table": weekly_absences_table,
            "weekly_departures_table": weekly_departures_table,
            "weeks_columns": [w['name'] for w in weeks]
        })

class DashboardDailyView(APIView):
    def get(self, request):
        date_str = request.query_params.get('week_start')
        statut_filter = request.query_params.get('statut', 'Absent')
        if date_str:
            start_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            today = datetime.now().date()
            start_date = today - timedelta(days=today.weekday())

        import calendar as cal_module
        # Trouver le dernier jour du mois pour savoir où s'arrêter
        _, last_day_of_month = cal_module.monthrange(start_date.year, start_date.month)
        end_of_month = date(start_date.year, start_date.month, last_day_of_month)

        # Générer les jours en ordre CHRONOLOGIQUE, en sautant le dimanche,
        # et en s'arrêtant à la fin du mois (pour la dernière semaine)
        day_names_map = {0: 'Lundi', 1: 'Mardi', 2: 'Mercredi', 3: 'Jeudi', 4: 'Vendredi', 5: 'Samedi'}
        days = []
        for i in range(7):
            current_date = start_date + timedelta(days=i)
            if current_date > end_of_month:  # Fin du mois atteinte
                break
            wd = current_date.weekday()
            if wd == 6:  # Dimanche → on saute
                continue
            is_holiday = PublicHoliday.objects.filter(date=current_date).exists()
            days.append({
                'date': current_date.isoformat(),
                'name': day_names_map[wd],
                'is_holiday': is_holiday
            })

        daily_absences_table = []
        daily_departures_table = []
        settings = Settings.load()
        disabled_families = settings.disabled_families or []
        families = Employee.objects.exclude(famille='').exclude(famille__in=disabled_families).values_list('famille', flat=True).distinct()
        latest_date = Attendance.objects.aggregate(max_date=Max('date'))['max_date']

        for fam in families:
            row = {'famille': fam}
            dep_row = {'famille': fam}
            total_target = 0
            total_deps = 0
            total_effectif = 0

            for d in days:
                if d['is_holiday']:
                    row[d['name']] = '-'
                    dep_row[d['name']] = '-'
                else:
                    base_qs = Attendance.objects.filter(
                        employee__famille=fam,
                        date=d['date']
                    )
                    count = base_qs.filter(statut=statut_filter).count()
                    row[d['name']] = count
                    total_target += count
                    total_effectif += base_qs.count()

                    dep_count = Departure.objects.filter(
                        employee__famille=fam,
                        date_added=d['date']
                    ).count()
                    dep_row[d['name']] = dep_count
                    total_deps += dep_count

            row['taux'] = round((total_target / total_effectif), 2) if total_effectif > 0 else 0
            dep_row['taux'] = round((total_deps / total_effectif), 2) if total_effectif > 0 else 0

            daily_absences_table.append(row)
            daily_departures_table.append(dep_row)

        return Response({
            "daily_absences_table": daily_absences_table,
            "daily_departures_table": daily_departures_table,
            "days_columns": days
        })

class UploadExcelView(APIView):
    def post(self, request):
        file_obj = request.FILES.get('file')
        date_str = request.data.get('date') # Format YYYY-MM-DD
        
        if not file_obj or not date_str:
            return Response({"error": "File and date are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            import_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            is_saturday = import_date.weekday() == 5
            families_off = []
            
            if is_saturday:
                saturday_config = SaturdayConfiguration.objects.filter(date=import_date).first()
                if saturday_config:
                    families_off = saturday_config.families_off
            
            is_public_holiday = PublicHoliday.objects.filter(date=import_date).exists()
            
            # Read Excel without headers to find the actual header row
            if file_obj.name.endswith('.csv'):
                df = pd.read_csv(file_obj, header=None)
            else:
                df = pd.read_excel(file_obj, header=None)
                
            # Auto-detect header row
            header_row_idx = 0
            for i, row in df.iterrows():
                row_str = " ".join(str(val).lower() for val in row.values if pd.notna(val))
                matches = 0
                if 'mle' in row_str or 'matricule' in row_str: matches += 1
                if 'nom' in row_str: matches += 1
                if 'seg' in row_str: matches += 1
                if 'affectation' in row_str: matches += 1
                
                if matches >= 2:
                    header_row_idx = i
                    break
                    
            df.columns = df.iloc[header_row_idx]
            df = df.iloc[header_row_idx + 1:].reset_index(drop=True)
            
            # Required Families filter
            families_json = request.data.get('families')
            import json
            import re
            
            if families_json:
                try:
                    ALLOWED_FAMILIES = json.loads(families_json)
                except json.JSONDecodeError:
                    ALLOWED_FAMILIES = ['CMA 2', 'CMA 3', 'MEP1', 'GPA-A', 'GPA-B', 'GPA', 'MAJORS']
            else:
                ALLOWED_FAMILIES = ['CMA 2', 'CMA 3', 'MEP1', 'GPA-A', 'GPA-B', 'GPA', 'MAJORS']
            
            # This is a simplified parsing logic based on standard column names
            settings = Settings.load()
            min_hours = settings.min_working_hours
            
            records_created = 0
            
            with transaction.atomic():
                # Helper to get value from row with multiple possible column names (case-insensitive)
                def get_val(r, possible_names):
                    for name in possible_names:
                        for col in r.index:
                            if str(col).strip() == name:
                                val = r[col]
                                return '' if pd.isna(val) else str(val).strip()
                    for name in possible_names:
                        for col in r.index:
                            if str(col).strip().lower() == name.lower():
                                val = r[col]
                                return '' if pd.isna(val) else str(val).strip()
                    return ''
                    
                
                # Map of normalized string (no space, no dash, lowercase) to Canonical Family Name
                ALLOWED_MAPPING = {}
                for f in ALLOWED_FAMILIES:
                    normalized_f = re.sub(r'[\s\-]', '', f).lower()
                    ALLOWED_MAPPING[normalized_f] = f.strip()

                for _, row in df.iterrows():
                    affectation_val = get_val(row, ['Affectation', 'affectation', 'affect', 'AFFECTATION'])
                    
                    # Normalize affectation: remove spaces and dashes, convert to lowercase
                    aff_norm = re.sub(r'[\s\-]', '', affectation_val).lower()
                    
                    if aff_norm in ALLOWED_MAPPING:
                        famille = ALLOWED_MAPPING[aff_norm]
                    else:
                        continue
                        
                    mle = get_val(row, ['Mle'])
                    if not mle:
                        mle = get_val(row, ['MLE', 'mle', 'Matricule', 'matricule'])
                    
                    mle_2 = get_val(row, ['MLE'])
                        
                    if not mle or mle == 'nan':
                        continue
                        
                    # Create or update Employee
                    nom_prenom = get_val(row, ['Nom & prénom', 'Nom & prenom', 'Nom et prénom', 'NOM & PRENOM', 'Nom', 'nom'])
                    cc = get_val(row, ['CC', 'cc'])
                    contrat = get_val(row, ['Contrat', 'contrat'])
                    seg_val = get_val(row, ['SEG', 'seg'])
                    
                    employee, _ = Employee.objects.update_or_create(
                        mle=mle,
                        defaults={
                            'mle_2': mle_2,
                            'nom_prenom': nom_prenom,
                            'famille': famille,
                            'seg': seg_val,
                            'affectation': affectation_val,
                            'cc': cc,
                            'contrat': contrat
                        }
                    )
                    
                    # Logic for Attendance
                    # Pointage is in the last column (named as the date)
                    pointage_val = row.iloc[-1]
                    pointage = '' if pd.isna(pointage_val) else str(pointage_val).strip()
                    
                    if not pointage or pointage in ['0', 'nan', '']:
                        pointage = "0"
                        heures_travaillees = 0.0
                    else:
                        try:
                            parts = pointage.split()
                            heures_travaillees = 0.0
                            if len(parts) >= 2 and len(parts) % 2 == 0:
                                for j in range(0, len(parts), 2):
                                    t1 = datetime.strptime(parts[j], '%H:%M')
                                    t2 = datetime.strptime(parts[j+1], '%H:%M')
                                    if t2 < t1:
                                        t2 += timedelta(days=1) # Night shift
                                    heures_travaillees += (t2 - t1).total_seconds() / 3600.0
                        except:
                            heures_travaillees = 0.0
                            
                    statut = 'Absent'
                    if is_public_holiday:
                        statut = 'Ferie'
                    elif famille in families_off:
                        statut = 'Repos'
                    elif heures_travaillees >= min_hours:
                        statut = 'Present'
                        
                    Attendance.objects.update_or_create(
                        employee=employee,
                        date=import_date,
                        defaults={
                            'heures_travaillees': heures_travaillees,
                            'statut': statut
                        }
                    )
                    
                    # Update Consecutive Absences
                    if statut == 'Present':
                        employee.consecutive_absences = 0
                    elif statut == 'Absent':
                        employee.consecutive_absences += 1
                        
                        if employee.consecutive_absences >= 4:
                            # Create Departure
                            Departure.objects.get_or_create(
                                employee=employee,
                                defaults={'absences_count': employee.consecutive_absences}
                            )
                    
                    employee.save()
                    records_created += 1
                    
                ImportHistory.objects.create(
                    user=request.user,
                    status='Success',
                    records_processed=records_created,
                    file_name=file_obj.name
                )
                
                if records_created == 0:
                    cols = ", ".join([str(c) for c in df.columns])
                    return Response({"message": f"Processed 0 records. DEBUG COLUMNS: {cols}"})
                
            return Response({"message": f"Imported successfully. Processed {records_created} records."})
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

