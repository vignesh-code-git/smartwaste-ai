import django.db.models.deletion
from django.db import migrations, models
from django.db.models import F, Q


# Step 3 of 3: drop the replaced columns and the unused Detection table,
# then add indexes and integrity constraints.
class Migration(migrations.Migration):
    dependencies = [
        ("smartwaste", "0006_move_data_to_new_structure"),
    ]

    operations = [
        migrations.DeleteModel(name="Detection"),
        migrations.RemoveField(model_name="site", name="district"),
        migrations.RemoveField(model_name="site", name="state"),
        migrations.RenameField(model_name="site", old_name="district_ref", new_name="district"),
        migrations.AlterField(
            model_name="site",
            name="district",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sites",
                to="smartwaste.district",
            ),
        ),
        migrations.RemoveField(model_name="cleanuptask", name="team"),
        migrations.RenameField(model_name="cleanuptask", old_name="team_ref", new_name="team"),
        migrations.AlterField(
            model_name="cleanuptask",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tasks",
                to="smartwaste.fieldteam",
            ),
        ),
        migrations.RemoveField(model_name="report", name="categories"),
        migrations.RemoveField(model_name="report", name="items"),
        migrations.AlterField(
            model_name="reportitem",
            name="report",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="items",
                to="smartwaste.report",
            ),
        ),
        migrations.AddIndex(model_name="report", index=models.Index(fields=["status"], name="report_status_idx")),
        migrations.AddIndex(model_name="report", index=models.Index(fields=["severity"], name="report_severity_idx")),
        migrations.AddIndex(model_name="report", index=models.Index(fields=["-created_at"], name="report_created_idx")),
        migrations.AddIndex(model_name="reportitem", index=models.Index(fields=["waste_type"], name="reportitem_type_idx")),
        migrations.AddIndex(model_name="cleanuptask", index=models.Index(fields=["status"], name="task_status_idx")),
        migrations.AddIndex(model_name="citizenissue", index=models.Index(fields=["status"], name="issue_status_idx")),
        migrations.AddConstraint(
            model_name="site",
            constraint=models.UniqueConstraint(fields=("name", "district"), name="unique_site_per_district"),
        ),
        migrations.AddConstraint(
            model_name="site",
            constraint=models.CheckConstraint(
                condition=Q(latitude__gte=6, latitude__lte=38, longitude__gte=68, longitude__lte=98),
                name="site_within_india",
            ),
        ),
        migrations.AddConstraint(
            model_name="report",
            constraint=models.CheckConstraint(
                condition=Q(plastic_items__lte=F("total_items")),
                name="report_plastic_within_total",
            ),
        ),
        migrations.AddConstraint(
            model_name="reportitem",
            constraint=models.CheckConstraint(
                condition=Q(peak_confidence__isnull=True) | Q(peak_confidence__gte=0, peak_confidence__lte=1),
                name="reportitem_confidence_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="systemsettings",
            constraint=models.CheckConstraint(
                condition=Q(min_confidence__gte=0.05, min_confidence__lte=0.95),
                name="settings_confidence_range",
            ),
        ),
    ]
