"""SmartWaste AI data model.

Locations      State → District → Site
Monitoring     Report → ReportItem (one row per detected piece of litter)
Operations     FieldTeam, CleanupTask
Citizens       CitizenIssue
Configuration  SystemSettings (single row), HelplineContact, FaqEntry
"""

import secrets

from django.db import models
from django.db.models import F, Q

from .reference import MATERIAL_CHOICES


class TimeStampedModel(models.Model):

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


SEVERITY_CHOICES = [
    ("clean", "Clean"),
    ("low", "Low"),
    ("moderate", "Moderate"),
    ("high", "High"),
    ("critical", "Critical"),
]

PRIORITY_CHOICES = [
    ("low", "Low"),
    ("medium", "Medium"),
    ("high", "High"),
    ("critical", "Critical"),
]


# ==================================================
# LOCATIONS
# ==================================================

class State(models.Model):

    """A state or union territory of India (reference data)."""

    KIND_CHOICES = [
        ("state", "State"),
        ("ut", "Union territory"),
    ]

    # ISO 3166-2:IN subdivision code without the "IN-" prefix
    code = models.CharField(max_length=2, unique=True)

    name = models.CharField(max_length=80, unique=True)

    kind = models.CharField(max_length=10, choices=KIND_CHOICES)

    capital = models.CharField(max_length=80)

    latitude = models.FloatField()

    longitude = models.FloatField()

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class District(models.Model):

    """Created as monitoring reaches a district, not preloaded."""

    state = models.ForeignKey(State, on_delete=models.PROTECT, related_name="districts")

    name = models.CharField(max_length=80)

    latitude = models.FloatField(null=True, blank=True)

    longitude = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["state__name", "name"]
        constraints = [
            models.UniqueConstraint(fields=["state", "name"], name="unique_district_per_state"),
        ]

    def __str__(self):
        return f"{self.name}, {self.state.name}"


class Site(TimeStampedModel):

    """A roadside location watched by a camera, or where citizens report litter."""

    name = models.CharField(max_length=120)

    locality = models.CharField(max_length=120, blank=True)

    district = models.ForeignKey(District, on_delete=models.PROTECT, related_name="sites")

    latitude = models.FloatField()

    longitude = models.FloatField()

    camera_id = models.CharField(max_length=40, blank=True)

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["name", "district"], name="unique_site_per_district"),
            # Rough bounding box of India, catching swapped or mistyped coordinates
            models.CheckConstraint(
                condition=Q(latitude__gte=6, latitude__lte=38, longitude__gte=68, longitude__lte=98),
                name="site_within_india",
            ),
        ]

    @property
    def state(self):
        return self.district.state

    def __str__(self):
        return f"{self.name}, {self.district.name}"


# ==================================================
# MONITORING
# ==================================================

class Report(TimeStampedModel):

    """The saved result of analysing one piece of footage."""

    STATUS_CHOICES = [
        ("pending", "Pending review"),
        ("reviewed", "Reviewed"),
        ("actioned", "Cleanup assigned"),
        ("resolved", "Resolved"),
    ]

    SOURCE_CHOICES = [
        ("demo", "Demo footage"),
        ("upload", "Uploaded footage"),
        ("camera", "Live camera"),
    ]

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="reports")

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)

    source_name = models.CharField(max_length=200, blank=True)

    # Summary of the report's items, kept for fast listing and ranking
    total_items = models.PositiveIntegerField()

    plastic_items = models.PositiveIntegerField()

    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="report_status_idx"),
            models.Index(fields=["severity"], name="report_severity_idx"),
            models.Index(fields=["-created_at"], name="report_created_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(plastic_items__lte=F("total_items")),
                name="report_plastic_within_total",
            ),
        ]

    def __str__(self):
        return f"RPT-{self.pk:04d} {self.site.name}"


class ReportItem(models.Model):

    """One piece of litter in a report. Timings are empty for items that
    were counted rather than tracked through footage."""

    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="items")

    # Track number within the footage
    track_id = models.PositiveIntegerField(null=True, blank=True)

    waste_type = models.CharField(max_length=60)

    material = models.CharField(max_length=20, choices=MATERIAL_CHOICES)

    first_seen = models.FloatField(null=True, blank=True)

    last_seen = models.FloatField(null=True, blank=True)

    peak_confidence = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["report", "track_id", "id"]
        indexes = [
            models.Index(fields=["waste_type"], name="reportitem_type_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(peak_confidence__isnull=True) | Q(peak_confidence__gte=0, peak_confidence__lte=1),
                name="reportitem_confidence_range",
            ),
        ]

    def __str__(self):
        return f"{self.waste_type} (report {self.report_id})"


# ==================================================
# OPERATIONS
# ==================================================

class FieldTeam(TimeStampedModel):

    name = models.CharField(max_length=120, unique=True)

    supervisor = models.CharField(max_length=120, blank=True)

    phone = models.CharField(max_length=30, blank=True)

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CleanupTask(TimeStampedModel):

    STATUS_CHOICES = [
        ("open", "Open"),
        ("in_progress", "In progress"),
        ("completed", "Completed"),
    ]

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="tasks")

    report = models.ForeignKey(
        Report,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )

    team = models.ForeignKey(
        FieldTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )

    title = models.CharField(max_length=200)

    description = models.TextField(blank=True)

    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")

    due_date = models.DateField(null=True, blank=True)

    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="task_status_idx"),
        ]

    def __str__(self):
        return self.title


# ==================================================
# CITIZENS
# ==================================================

def new_reference():
    return f"SW-{secrets.token_hex(3).upper()}"


class CitizenIssue(TimeStampedModel):

    """Litter reports, callback requests and support queries raised from the
    citizen-facing pages."""

    CATEGORY_CHOICES = [
        ("litter", "Litter report"),
        ("callback", "Callback request"),
        ("support", "Support request"),
    ]

    STATUS_CHOICES = [
        ("received", "Received"),
        ("assigned", "Assigned"),
        ("resolved", "Resolved"),
    ]

    reference = models.CharField(max_length=12, unique=True, default=new_reference, editable=False)

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="litter")

    name = models.CharField(max_length=120, blank=True)

    contact = models.CharField(max_length=120, blank=True)

    site = models.ForeignKey(
        Site,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issues",
    )

    location = models.CharField(max_length=200, blank=True)

    latitude = models.FloatField(null=True, blank=True)

    longitude = models.FloatField(null=True, blank=True)

    waste_type = models.CharField(max_length=60, blank=True)

    description = models.TextField(blank=True)

    photo = models.ImageField(upload_to="issues/", null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="received")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="issue_status_idx"),
        ]

    def __str__(self):
        return self.reference


# ==================================================
# CONFIGURATION
# ==================================================

class SystemSettings(models.Model):

    """The command centre's preferences: always the single row with pk 1."""

    organisation = models.CharField(max_length=160, default="Roadside Waste Monitoring Programme")

    default_site = models.ForeignKey(
        Site,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    min_confidence = models.FloatField(default=0.3)

    show_outlines = models.BooleanField(default=True)

    show_boxes = models.BooleanField(default=False)

    show_labels = models.BooleanField(default=True)

    alerts_enabled = models.BooleanField(default=True)

    notifications_seen_at = models.DateTimeField(null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "system settings"
        constraints = [
            models.CheckConstraint(
                condition=Q(min_confidence__gte=0.05, min_confidence__lte=0.95),
                name="settings_confidence_range",
            ),
        ]

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings

    def __str__(self):
        return "System settings"


class HelplineContact(models.Model):

    KIND_CHOICES = [
        ("emergency", "Emergency number"),
        ("department", "Department"),
    ]

    kind = models.CharField(max_length=20, choices=KIND_CHOICES)

    name = models.CharField(max_length=120)

    number = models.CharField(max_length=30, blank=True)

    description = models.CharField(max_length=240, blank=True)

    hours = models.CharField(max_length=80, blank=True)

    icon = models.CharField(max_length=30, default="phone")

    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["kind", "order", "name"]

    def __str__(self):
        return self.name


class FaqEntry(models.Model):

    question = models.CharField(max_length=240)

    answer = models.TextField()

    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "FAQ entry"
        verbose_name_plural = "FAQ entries"

    def __str__(self):
        return self.question
