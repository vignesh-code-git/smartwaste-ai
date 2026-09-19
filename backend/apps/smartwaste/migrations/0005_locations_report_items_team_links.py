import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


# Step 1 of 3: add the new tables and link columns next to the old ones.
class Migration(migrations.Migration):
    dependencies = [
        ("smartwaste", "0004_remove_systemsettings_show_intro"),
    ]

    operations = [
        migrations.CreateModel(
            name="State",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=2, unique=True)),
                ("name", models.CharField(max_length=80, unique=True)),
                ("kind", models.CharField(choices=[("state", "State"), ("ut", "Union territory")], max_length=10)),
                ("capital", models.CharField(max_length=80)),
                ("latitude", models.FloatField()),
                ("longitude", models.FloatField()),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="District",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                (
                    "state",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="districts",
                        to="smartwaste.state",
                    ),
                ),
            ],
            options={
                "ordering": ["state__name", "name"],
                "constraints": [models.UniqueConstraint(fields=("state", "name"), name="unique_district_per_state")],
            },
        ),
        migrations.CreateModel(
            name="ReportItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("track_id", models.PositiveIntegerField(blank=True, null=True)),
                ("waste_type", models.CharField(max_length=60)),
                (
                    "material",
                    models.CharField(
                        choices=[("plastic", "Plastic"), ("paper", "Paper"), ("metal", "Metal"), ("other", "Other")],
                        max_length=20,
                    ),
                ),
                ("first_seen", models.FloatField(blank=True, null=True)),
                ("last_seen", models.FloatField(blank=True, null=True)),
                ("peak_confidence", models.FloatField(blank=True, null=True)),
                (
                    "report",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="item_rows",
                        to="smartwaste.report",
                    ),
                ),
            ],
            options={"ordering": ["report", "track_id", "id"]},
        ),
        migrations.AddField(
            model_name="site",
            name="district_ref",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="smartwaste.district",
            ),
        ),
        migrations.AddField(
            model_name="cleanuptask",
            name="team_ref",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="smartwaste.fieldteam",
            ),
        ),
        *[
            migrations.AddField(
                model_name=model,
                name="updated_at",
                field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
                preserve_default=False,
            )
            for model in ["site", "report", "cleanuptask", "citizenissue", "fieldteam"]
        ],
    ]
