from collections import Counter

from django.db import transaction
from rest_framework import serializers

from .locations import resolve_district
from .models import (
    CitizenIssue,
    CleanupTask,
    District,
    FaqEntry,
    FieldTeam,
    HelplineContact,
    Report,
    ReportItem,
    Site,
    State,
    SystemSettings,
)
from .reference import material_for


# --------------------------------------------------
# PRIORITY SCORING
# --------------------------------------------------
# A site's priority grows with litter that has not
# been cleared, open citizen complaints, and the
# severity of its most recent report.
# --------------------------------------------------

SEVERITY_WEIGHT = {
    "clean": 0,
    "low": 3,
    "moderate": 10,
    "high": 20,
    "critical": 30,
}

ISSUE_WEIGHT = 5

PRIORITY_LEVELS = [
    (60, "critical"),
    (35, "high"),
    (15, "medium"),
    (0, "low"),
]


def category_counts(items):
    return dict(Counter(item.waste_type for item in items).most_common())


def site_statistics(site):

    # Expects reports (newest first, with items), tasks and issues prefetched
    reports = list(site.reports.all())

    unresolved = [report for report in reports if report.status != "resolved"]

    latest = reports[0] if reports else None

    categories = Counter()

    for report in unresolved:
        categories.update(item.waste_type for item in report.items.all())

    open_tasks = sum(1 for task in site.tasks.all() if task.status != "completed")

    open_issues = sum(1 for issue in site.issues.all() if issue.status != "resolved")

    score = (
        sum(report.total_items for report in unresolved)
        + ISSUE_WEIGHT * open_issues
        + (SEVERITY_WEIGHT.get(latest.severity, 0) if latest else 0)
    )

    level = next(name for floor, name in PRIORITY_LEVELS if score >= floor)

    return {
        "report_count": len(reports),
        "unresolved_reports": len(unresolved),
        "total_items": sum(report.total_items for report in reports),
        "unresolved_items": sum(report.total_items for report in unresolved),
        "plastic_items": sum(report.plastic_items for report in unresolved),
        "open_tasks": open_tasks,
        "open_issues": open_issues,
        "latest_severity": latest.severity if latest else None,
        "last_report_at": latest.created_at if latest else None,
        "top_categories": dict(categories.most_common(4)),
        "priority_score": score,
        "priority_level": level,
    }


# --------------------------------------------------
# LOCATIONS
# --------------------------------------------------

class StateSerializer(serializers.ModelSerializer):

    class Meta:

        model = State

        fields = ["id", "code", "name", "kind", "capital", "latitude", "longitude"]


class DistrictSerializer(serializers.ModelSerializer):

    state = serializers.CharField(source="state.name", read_only=True)

    state_code = serializers.CharField(source="state.code", read_only=True)

    site_count = serializers.IntegerField(read_only=True)

    class Meta:

        model = District

        fields = ["id", "name", "state", "state_code", "latitude", "longitude", "site_count"]


class SiteSerializer(serializers.ModelSerializer):

    """Sites are read and written with plain district and state names; the
    serializer files them under the matching District row."""

    district = serializers.CharField(source="district.name")

    state = serializers.CharField(source="district.state.name")

    district_id = serializers.IntegerField(source="district.id", read_only=True)

    state_code = serializers.CharField(source="district.state.code", read_only=True)

    stats = serializers.SerializerMethodField()

    class Meta:

        model = Site

        fields = [
            "id",
            "name",
            "locality",
            "district",
            "district_id",
            "state",
            "state_code",
            "latitude",
            "longitude",
            "camera_id",
            "is_active",
            "created_at",
            "updated_at",
            "stats",
        ]

    def get_stats(self, site):
        return site_statistics(site)

    def validate(self, attrs):

        # Same bounds as the site_within_india constraint, checked first so
        # nothing is created for a point outside India
        latitude = attrs.get("latitude", self.instance.latitude if self.instance else None)
        longitude = attrs.get("longitude", self.instance.longitude if self.instance else None)
        if latitude is not None and longitude is not None and not (6 <= latitude <= 38 and 68 <= longitude <= 98):
            raise serializers.ValidationError({"latitude": "The location must be within India."})

        location = attrs.pop("district", None)

        if location is not None:
            state = location.get("state", {}).get("name") or (
                self.instance.district.state.code if self.instance else None
            )
            attrs["district"] = resolve_district(
                state,
                location.get("name"),
                attrs.get("latitude"),
                attrs.get("longitude"),
            )

        name = attrs.get("name", self.instance.name if self.instance else None)
        district = attrs.get("district", self.instance.district if self.instance else None)

        duplicate = Site.objects.filter(name__iexact=name, district=district)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError({"name": f"{district.name} already has a site called {name}."})

        return attrs

    # The district fields use dotted sources, which DRF will not write itself
    def create(self, validated_data):
        return Site.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


# Compact site entry for pickers and search results
class SiteSummarySerializer(serializers.ModelSerializer):

    district = serializers.CharField(source="district.name", read_only=True)

    state = serializers.CharField(source="district.state.name", read_only=True)

    class Meta:

        model = Site

        fields = ["id", "name", "locality", "district", "state", "latitude", "longitude", "camera_id"]


# --------------------------------------------------
# REPORTS
# --------------------------------------------------

class ReportItemSerializer(serializers.ModelSerializer):

    # Field names match the detection register exported by the dashboard
    track = serializers.IntegerField(source="track_id", required=False, allow_null=True)

    type = serializers.CharField(source="waste_type", max_length=60)

    material = serializers.ChoiceField(choices=ReportItem._meta.get_field("material").choices, required=False)

    firstSeen = serializers.FloatField(source="first_seen", required=False, allow_null=True)

    lastSeen = serializers.FloatField(source="last_seen", required=False, allow_null=True)

    peakConfidence = serializers.FloatField(
        source="peak_confidence", required=False, allow_null=True, min_value=0, max_value=1
    )

    class Meta:

        model = ReportItem

        fields = ["id", "track", "type", "material", "firstSeen", "lastSeen", "peakConfidence"]


class ReportSerializer(serializers.ModelSerializer):

    site_name = serializers.CharField(source="site.name", read_only=True)

    site_district = serializers.CharField(source="site.district.name", read_only=True)

    site_state = serializers.CharField(source="site.district.state.name", read_only=True)

    items = ReportItemSerializer(many=True, required=False)

    categories = serializers.SerializerMethodField()

    task_count = serializers.SerializerMethodField()

    class Meta:

        model = Report

        fields = [
            "id",
            "site",
            "site_name",
            "site_district",
            "site_state",
            "source",
            "source_name",
            "total_items",
            "plastic_items",
            "severity",
            "categories",
            "items",
            "status",
            "notes",
            "task_count",
            "created_at",
            "updated_at",
        ]

    def get_categories(self, report):
        return category_counts(report.items.all())

    def get_task_count(self, report):
        return len(report.tasks.all())

    def validate(self, attrs):

        items = attrs.get("items")

        # With an item list, the totals are taken from it
        if items:
            for item in items:
                item.setdefault("material", material_for(item["waste_type"]))
            attrs["total_items"] = len(items)
            attrs["plastic_items"] = sum(1 for item in items if item["material"] == "plastic")

        total = attrs.get("total_items", self.instance.total_items if self.instance else 0)
        plastic = attrs.get("plastic_items", self.instance.plastic_items if self.instance else 0)

        if plastic > total:
            raise serializers.ValidationError({"plastic_items": "Cannot exceed the total number of items."})

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items", [])
        report = Report.objects.create(**validated_data)
        ReportItem.objects.bulk_create(ReportItem(report=report, **item) for item in items)
        return report

    def update(self, instance, validated_data):
        if "items" in validated_data:
            raise serializers.ValidationError({"items": "A report's items cannot be changed after it is filed."})
        return super().update(instance, validated_data)


# --------------------------------------------------
# OPERATIONS
# --------------------------------------------------

class CleanupTaskSerializer(serializers.ModelSerializer):

    site_name = serializers.CharField(source="site.name", read_only=True)

    site_district = serializers.CharField(source="site.district.name", read_only=True)

    team_name = serializers.CharField(source="team.name", read_only=True, default=None)

    class Meta:

        model = CleanupTask

        fields = [
            "id",
            "site",
            "site_name",
            "site_district",
            "report",
            "title",
            "description",
            "team",
            "team_name",
            "priority",
            "status",
            "due_date",
            "created_at",
            "updated_at",
            "completed_at",
        ]

        read_only_fields = ["completed_at"]


class FieldTeamSerializer(serializers.ModelSerializer):

    open_tasks = serializers.IntegerField(read_only=True)

    class Meta:

        model = FieldTeam

        fields = ["id", "name", "supervisor", "phone", "is_active", "open_tasks"]


# --------------------------------------------------
# CITIZENS
# --------------------------------------------------

class CitizenIssueSerializer(serializers.ModelSerializer):

    site_name = serializers.CharField(source="site.name", read_only=True, default=None)

    class Meta:

        model = CitizenIssue

        fields = [
            "id",
            "reference",
            "category",
            "name",
            "contact",
            "site",
            "site_name",
            "location",
            "latitude",
            "longitude",
            "waste_type",
            "description",
            "photo",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = ["reference"]


# Public lookup by reference: no personal details
class IssueStatusSerializer(serializers.ModelSerializer):

    class Meta:

        model = CitizenIssue

        fields = [
            "reference",
            "category",
            "location",
            "waste_type",
            "status",
            "created_at",
        ]


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

class SystemSettingsSerializer(serializers.ModelSerializer):

    default_site_name = serializers.CharField(source="default_site.name", read_only=True, default=None)

    default_site_district = serializers.CharField(source="default_site.district.name", read_only=True, default=None)

    default_site_state = serializers.CharField(source="default_site.district.state.name", read_only=True, default=None)

    class Meta:

        model = SystemSettings

        fields = [
            "organisation",
            "default_site",
            "default_site_name",
            "default_site_district",
            "default_site_state",
            "min_confidence",
            "show_outlines",
            "show_boxes",
            "show_labels",
            "alerts_enabled",
            "notifications_seen_at",
            "updated_at",
        ]

    def validate_min_confidence(self, value):
        if not 0.05 <= value <= 0.95:
            raise serializers.ValidationError("Must be between 0.05 and 0.95.")
        return value


class HelplineContactSerializer(serializers.ModelSerializer):

    class Meta:

        model = HelplineContact

        fields = ["id", "kind", "name", "number", "description", "hours", "icon", "order"]


class FaqEntrySerializer(serializers.ModelSerializer):

    class Meta:

        model = FaqEntry

        fields = ["id", "question", "answer", "order"]
