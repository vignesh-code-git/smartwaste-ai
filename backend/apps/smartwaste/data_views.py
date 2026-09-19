import re

from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .locations import resolve_district, reverse_geocode, search_places
from .models import (
    CitizenIssue,
    CleanupTask,
    District,
    FaqEntry,
    FieldTeam,
    HelplineContact,
    Report,
    Site,
    State,
    SystemSettings,
)
from .serializers import (
    CitizenIssueSerializer,
    CleanupTaskSerializer,
    DistrictSerializer,
    FaqEntrySerializer,
    FieldTeamSerializer,
    HelplineContactSerializer,
    IssueStatusSerializer,
    ReportSerializer,
    SiteSerializer,
    SiteSummarySerializer,
    StateSerializer,
    SystemSettingsSerializer,
)


def search(queryset, request, *fields):

    term = request.query_params.get("search", "").strip()

    if not term:
        return queryset

    query = Q()

    for field in fields:
        query |= Q(**{f"{field}__icontains": term})

    return queryset.filter(query)


def filter_exact(queryset, request, **fields):

    """Filters by query parameters; ``fields`` maps each parameter to the
    lookup it applies, e.g. ``state="site__district__state__name"``."""

    for param, lookup in fields.items():

        value = request.query_params.get(param)

        if value:
            queryset = queryset.filter(**{lookup: value})

    return queryset


SITE_LOCATION = ("district", "district__state")


# --------------------------------------------------
# LOCATIONS
# --------------------------------------------------

class StateViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = StateSerializer

    queryset = State.objects.all()


class DistrictViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = DistrictSerializer

    def get_queryset(self):

        queryset = District.objects.select_related("state").annotate(site_count=Count("sites"))

        return filter_exact(queryset, self.request, state="state__code")


class PlaceSearchView(APIView):

    """Monitoring sites and places anywhere in India matching ``q``."""

    def get(self, request):

        query = request.query_params.get("q", "").strip()

        if len(query) < 2:
            return Response({"sites": [], "places": []})

        sites = Site.objects.select_related(*SITE_LOCATION).filter(
            Q(name__icontains=query)
            | Q(locality__icontains=query)
            | Q(district__name__icontains=query)
            | Q(district__state__name__icontains=query)
        )[:5]

        return Response({
            "sites": SiteSummarySerializer(sites, many=True).data,
            "places": search_places(query),
        })


# --------------------------------------------------
# SITES
# --------------------------------------------------

class SiteViewSet(viewsets.ModelViewSet):

    serializer_class = SiteSerializer

    def get_queryset(self):

        queryset = Site.objects.select_related(*SITE_LOCATION).prefetch_related(
            Prefetch(
                "reports",
                queryset=Report.objects.order_by("-created_at").prefetch_related("items"),
            ),
            "tasks",
            "issues",
        )

        queryset = filter_exact(
            queryset,
            self.request,
            state="district__state__name",
            district="district__name",
        )

        return search(queryset, self.request, "name", "locality", "district__name", "district__state__name")

    # Validation may create the site's district; keep it only if the site is saved
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="from-place")
    @transaction.atomic
    def from_place(self, request):

        """The site for a place picked from place search, created on first use."""

        try:
            name = str(request.data["name"]).strip()[:120]
            latitude = float(request.data["latitude"])
            longitude = float(request.data["longitude"])
        except (KeyError, TypeError, ValueError):
            raise ValidationError("name, latitude and longitude are required.")

        existing = Site.objects.filter(
            name__iexact=name,
            latitude__range=(latitude - 0.01, latitude + 0.01),
            longitude__range=(longitude - 0.01, longitude + 0.01),
        ).first()

        if existing:
            return Response(self.get_serializer(self.get_queryset().get(pk=existing.pk)).data)

        place = reverse_geocode(latitude, longitude)

        district = resolve_district(place["state"], place["district"] or name, latitude, longitude)

        try:
            site, created = Site.objects.get_or_create(
                name=name,
                district=district,
                defaults={
                    "locality": place["locality"] if place["locality"] != name else "",
                    "latitude": latitude,
                    "longitude": longitude,
                },
            )
        except IntegrityError:
            raise ValidationError("That location is outside India.")

        return Response(
            self.get_serializer(self.get_queryset().get(pk=site.pk)).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# --------------------------------------------------
# REPORTS
# --------------------------------------------------

class ReportViewSet(viewsets.ModelViewSet):

    serializer_class = ReportSerializer

    def get_queryset(self):

        queryset = Report.objects.select_related("site__district__state").prefetch_related("tasks", "items")

        queryset = filter_exact(
            queryset,
            self.request,
            site="site",
            status="status",
            severity="severity",
            source="source",
        )

        return search(queryset, self.request, "site__name", "site__district__name", "source_name", "notes")


# --------------------------------------------------
# CLEANUP TASKS
# --------------------------------------------------

class CleanupTaskViewSet(viewsets.ModelViewSet):

    serializer_class = CleanupTaskSerializer

    def get_queryset(self):

        queryset = CleanupTask.objects.select_related("site__district", "team")

        queryset = filter_exact(
            queryset,
            self.request,
            site="site",
            status="status",
            priority="priority",
            report="report",
            team="team",
        )

        return search(queryset, self.request, "title", "team__name", "site__name")

    def perform_create(self, serializer):

        task = serializer.save()

        # A report with cleanup assigned moves out of the review queue
        if task.report and task.report.status in ("pending", "reviewed"):
            task.report.status = "actioned"
            task.report.save(update_fields=["status", "updated_at"])

    def perform_update(self, serializer):

        completed = serializer.validated_data.get("status") == "completed"

        task = serializer.save(
            completed_at=timezone.now() if completed else None
        )

        # The report is resolved once all of its cleanup work is done
        report = task.report

        if report and not report.tasks.exclude(status="completed").exists():
            report.status = "resolved"
            report.save(update_fields=["status", "updated_at"])


# --------------------------------------------------
# CITIZEN ISSUES
# --------------------------------------------------

class CitizenIssueViewSet(viewsets.ModelViewSet):

    serializer_class = CitizenIssueSerializer

    def get_queryset(self):

        queryset = CitizenIssue.objects.select_related("site")

        queryset = filter_exact(queryset, self.request, category="category", status="status", site="site")

        return search(queryset, self.request, "reference", "location", "description", "name")


class IssueStatusView(APIView):

    """Lets a citizen track an issue by its reference, without exposing
    anyone's personal details."""

    def get(self, request, reference):

        issue = get_object_or_404(CitizenIssue, reference=reference.strip().upper())

        return Response(IssueStatusSerializer(issue).data)


# --------------------------------------------------
# GLOBAL SEARCH
# --------------------------------------------------
# Powers the search bar in the header: sites,
# reports, cleanup tasks and citizen issues.
# --------------------------------------------------

REPORT_CODE = re.compile(r"^(?:rpt-?)?0*(\d+)$", re.IGNORECASE)

SEARCH_LIMIT = 5


class GlobalSearchView(APIView):

    def get(self, request):

        term = request.query_params.get("q", "").strip()

        if len(term) < 2:
            return Response({"results": []})

        results = []

        for site in Site.objects.select_related(*SITE_LOCATION).filter(
            Q(name__icontains=term)
            | Q(locality__icontains=term)
            | Q(district__name__icontains=term)
            | Q(district__state__name__icontains=term)
            | Q(camera_id__iexact=term)
        )[:SEARCH_LIMIT]:
            results.append({
                "type": "site",
                "id": site.id,
                "title": site.name,
                "subtitle": f"{site.district.name}, {site.district.state.name}",
                "link": f"/waste-map?site={site.id}",
            })

        report_query = Q(site__name__icontains=term) | Q(source_name__icontains=term) | Q(notes__icontains=term)
        code = REPORT_CODE.match(term)
        if code:
            report_query |= Q(pk=int(code.group(1)))

        for report in Report.objects.select_related("site").filter(report_query)[:SEARCH_LIMIT]:
            results.append({
                "type": "report",
                "id": report.id,
                "title": f"RPT-{report.id:04d} · {report.site.name}",
                "subtitle": f"{report.total_items} items · {report.get_severity_display()} · {report.get_status_display()}",
                "link": f"/reports?report={report.id}",
            })

        for task in CleanupTask.objects.select_related("site", "team").filter(
            Q(title__icontains=term) | Q(team__name__icontains=term) | Q(site__name__icontains=term)
        )[:SEARCH_LIMIT]:
            results.append({
                "type": "task",
                "id": task.id,
                "title": task.title,
                "subtitle": f"{task.get_status_display()} · {task.team.name if task.team else 'Unassigned'}",
                "link": f"/cleanup-tasks?task={task.id}",
            })

        for issue in CitizenIssue.objects.filter(
            Q(reference__icontains=term) | Q(location__icontains=term) | Q(description__icontains=term)
        )[:SEARCH_LIMIT]:
            results.append({
                "type": "issue",
                "id": issue.id,
                "title": f"{issue.reference} · {issue.get_category_display()}",
                "subtitle": f"{issue.get_status_display()}{f' · {issue.location}' if issue.location else ''}",
                "link": f"/report-issue?ref={issue.reference}",
            })

        return Response({"results": results})


# --------------------------------------------------
# OVERVIEW
# --------------------------------------------------
# Headline counts and recent events for the header
# notifications and the support page status panel.
# --------------------------------------------------

class OverviewView(APIView):

    def get(self, request):

        events = []

        for report in Report.objects.select_related("site").filter(
            severity__in=["high", "critical"]
        )[:6]:
            events.append({
                "type": "report",
                "id": report.id,
                "title": f"{report.get_severity_display()} litter at {report.site.name}",
                "detail": f"{report.total_items} items · {report.plastic_items} plastic",
                "created_at": report.created_at,
                "link": f"/reports?report={report.id}",
            })

        for issue in CitizenIssue.objects.select_related("site")[:6]:
            events.append({
                "type": "issue",
                "id": issue.id,
                "title": f"{issue.get_category_display()} {issue.reference}",
                "detail": issue.location or (issue.site.name if issue.site else ""),
                "created_at": issue.created_at,
                "link": f"/report-issue?ref={issue.reference}",
            })

        events.sort(key=lambda event: event["created_at"], reverse=True)

        return Response({
            "sites": Site.objects.count(),
            "reports": Report.objects.count(),
            "pending_reports": Report.objects.filter(status="pending").count(),
            "open_tasks": CleanupTask.objects.exclude(status="completed").count(),
            "open_issues": CitizenIssue.objects.exclude(status="resolved").count(),
            "events": events[:8],
        }, status=status.HTTP_200_OK)


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

class FieldTeamViewSet(viewsets.ModelViewSet):

    serializer_class = FieldTeamSerializer

    def get_queryset(self):
        return FieldTeam.objects.annotate(
            open_tasks=Count("tasks", filter=~Q(tasks__status="completed"))
        )


class HelplineContactViewSet(viewsets.ModelViewSet):

    serializer_class = HelplineContactSerializer

    def get_queryset(self):
        return filter_exact(HelplineContact.objects.all(), self.request, kind="kind")


class FaqEntryViewSet(viewsets.ModelViewSet):

    serializer_class = FaqEntrySerializer

    queryset = FaqEntry.objects.all()


class SettingsView(APIView):

    """The single settings record: GET to read, PATCH to change."""

    def get(self, request):
        return Response(SystemSettingsSerializer(SystemSettings.load()).data)

    def patch(self, request):
        serializer = SystemSettingsSerializer(SystemSettings.load(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
