from django.db import migrations

from apps.smartwaste.reference import STATES, material_for, state_code


# Step 2 of 3: fill the new tables from the old columns.
def forwards(apps, schema_editor):
    State = apps.get_model("smartwaste", "State")
    District = apps.get_model("smartwaste", "District")
    Site = apps.get_model("smartwaste", "Site")
    Report = apps.get_model("smartwaste", "Report")
    ReportItem = apps.get_model("smartwaste", "ReportItem")
    CleanupTask = apps.get_model("smartwaste", "CleanupTask")
    FieldTeam = apps.get_model("smartwaste", "FieldTeam")

    for code, name, kind, capital, latitude, longitude in STATES:
        State.objects.update_or_create(
            code=code,
            defaults={"name": name, "kind": kind, "capital": capital, "latitude": latitude, "longitude": longitude},
        )

    for site in Site.objects.all():
        code = state_code(site.state)
        if not code:
            raise ValueError(f"Site {site.pk} has an unknown state: {site.state!r}")

        district, _ = District.objects.get_or_create(
            state=State.objects.get(code=code),
            name=site.district.strip(),
            defaults={"latitude": site.latitude, "longitude": site.longitude},
        )
        site.district_ref = district
        site.save(update_fields=["district_ref"])

    rows = []
    for report in Report.objects.all():
        if report.items:
            for item in report.items:
                rows.append(ReportItem(
                    report=report,
                    track_id=item.get("id"),
                    waste_type=item["type"],
                    material=item.get("material") or material_for(item["type"]),
                    first_seen=item.get("firstSeen"),
                    last_seen=item.get("lastSeen"),
                    peak_confidence=item.get("peakConfidence"),
                ))
        else:
            # Reports that only recorded counts per waste type
            for waste_type, count in report.categories.items():
                rows.extend(
                    ReportItem(report=report, waste_type=waste_type, material=material_for(waste_type))
                    for _ in range(count)
                )
    ReportItem.objects.bulk_create(rows)

    for task in CleanupTask.objects.exclude(team=""):
        task.team_ref, _ = FieldTeam.objects.get_or_create(name=task.team.strip())
        task.save(update_fields=["team_ref"])


class Migration(migrations.Migration):
    dependencies = [
        ("smartwaste", "0005_locations_report_items_team_links"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
