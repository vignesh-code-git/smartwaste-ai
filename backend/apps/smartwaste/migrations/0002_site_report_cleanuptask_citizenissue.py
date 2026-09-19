import django.db.models.deletion
from django.db import migrations, models

import apps.smartwaste.models


# Adds the monitoring data models. The existing Detection model is left as
# it is; its model/migration mismatch (image vs video) predates this change.

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


class Migration(migrations.Migration):

    dependencies = [
        ("smartwaste", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Site",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("locality", models.CharField(blank=True, max_length=120)),
                ("district", models.CharField(max_length=80)),
                ("state", models.CharField(max_length=80)),
                ("latitude", models.FloatField()),
                ("longitude", models.FloatField()),
                ("camera_id", models.CharField(blank=True, max_length=40)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Report",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source", models.CharField(choices=[("demo", "Demo footage"), ("upload", "Uploaded footage"), ("camera", "Live camera")], max_length=20)),
                ("source_name", models.CharField(blank=True, max_length=200)),
                ("total_items", models.PositiveIntegerField()),
                ("plastic_items", models.PositiveIntegerField()),
                ("severity", models.CharField(choices=SEVERITY_CHOICES, max_length=20)),
                ("categories", models.JSONField(default=dict)),
                ("items", models.JSONField(default=list)),
                ("status", models.CharField(choices=[("pending", "Pending review"), ("reviewed", "Reviewed"), ("actioned", "Cleanup assigned"), ("resolved", "Resolved")], default="pending", max_length=20)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("site", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reports", to="smartwaste.site")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="CleanupTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("team", models.CharField(blank=True, max_length=120)),
                ("priority", models.CharField(choices=PRIORITY_CHOICES, default="medium", max_length=20)),
                ("status", models.CharField(choices=[("open", "Open"), ("in_progress", "In progress"), ("completed", "Completed")], default="open", max_length=20)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("report", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="tasks", to="smartwaste.report")),
                ("site", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tasks", to="smartwaste.site")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="CitizenIssue",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(default=apps.smartwaste.models.new_reference, editable=False, max_length=12, unique=True)),
                ("category", models.CharField(choices=[("litter", "Litter report"), ("callback", "Callback request"), ("support", "Support request")], default="litter", max_length=20)),
                ("name", models.CharField(blank=True, max_length=120)),
                ("contact", models.CharField(blank=True, max_length=120)),
                ("location", models.CharField(blank=True, max_length=200)),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                ("waste_type", models.CharField(blank=True, max_length=60)),
                ("description", models.TextField(blank=True)),
                ("photo", models.ImageField(blank=True, null=True, upload_to="issues/")),
                ("status", models.CharField(choices=[("received", "Received"), ("assigned", "Assigned"), ("resolved", "Resolved")], default="received", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("site", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="issues", to="smartwaste.site")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
