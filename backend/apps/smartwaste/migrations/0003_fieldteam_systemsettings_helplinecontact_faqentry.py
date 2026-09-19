import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("smartwaste", "0002_site_report_cleanuptask_citizenissue"),
    ]

    operations = [
        migrations.CreateModel(
            name="FieldTeam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
                ("supervisor", models.CharField(blank=True, max_length=120)),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="SystemSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("organisation", models.CharField(default="Roadside Waste Monitoring Programme", max_length=160)),
                ("min_confidence", models.FloatField(default=0.3)),
                ("show_outlines", models.BooleanField(default=True)),
                ("show_boxes", models.BooleanField(default=False)),
                ("show_labels", models.BooleanField(default=True)),
                ("show_intro", models.BooleanField(default=True)),
                ("alerts_enabled", models.BooleanField(default=True)),
                ("notifications_seen_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("default_site", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="smartwaste.site")),
            ],
            options={"verbose_name_plural": "system settings"},
        ),
        migrations.CreateModel(
            name="HelplineContact",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("emergency", "Emergency number"), ("department", "Department")], max_length=20)),
                ("name", models.CharField(max_length=120)),
                ("number", models.CharField(blank=True, max_length=30)),
                ("description", models.CharField(blank=True, max_length=240)),
                ("hours", models.CharField(blank=True, max_length=80)),
                ("icon", models.CharField(default="phone", max_length=30)),
                ("order", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["kind", "order", "name"]},
        ),
        migrations.CreateModel(
            name="FaqEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question", models.CharField(max_length=240)),
                ("answer", models.TextField()),
                ("order", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["order", "id"], "verbose_name": "FAQ entry", "verbose_name_plural": "FAQ entries"},
        ),
    ]
