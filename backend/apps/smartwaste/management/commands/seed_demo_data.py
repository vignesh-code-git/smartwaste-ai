import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.smartwaste.locations import resolve_district
from apps.smartwaste.models import (
    CitizenIssue,
    CleanupTask,
    FaqEntry,
    FieldTeam,
    HelplineContact,
    Report,
    ReportItem,
    Site,
    State,
    SystemSettings,
)
from apps.smartwaste.reference import STATES


# name, locality, district, state, latitude, longitude
SITES = [
    ("Kumily Road", "Kumily", "Idukki", "Kerala", 9.6060, 77.1690),
    ("Thekkady Junction", "Kumily", "Idukki", "Kerala", 9.6035, 77.1611),
    ("Kumily Main Road", "Kumily", "Idukki", "Kerala", 9.6082, 77.1716),
    ("Munnar Town Road", "Munnar", "Idukki", "Kerala", 10.0889, 77.0595),
    ("MG Road", "Ernakulam", "Ernakulam", "Kerala", 9.9658, 76.2856),
    ("Kovalam Beach Road", "Kovalam", "Thiruvananthapuram", "Kerala", 8.4004, 76.9787),
    ("Beach Road", "Kozhikode", "Kozhikode", "Kerala", 11.2588, 75.7804),
    ("Boat Jetty Road", "Alappuzha", "Alappuzha", "Kerala", 9.4981, 76.3388),
    ("Swaraj Round", "Thrissur", "Thrissur", "Kerala", 10.5276, 76.2144),
    ("Outer Ring Road", "Marathahalli", "Bengaluru Urban", "Karnataka", 12.9569, 77.7011),
    ("Old Mahabalipuram Road", "Thoraipakkam", "Chengalpattu", "Tamil Nadu", 12.9373, 80.2332),
    ("Western Express Highway", "Andheri", "Mumbai Suburban", "Maharashtra", 19.1136, 72.8697),
    ("FC Road", "Shivajinagar", "Pune", "Maharashtra", 18.5236, 73.8410),
    ("Ring Road", "Lajpat Nagar", "South East Delhi", "Delhi", 28.5672, 77.2433),
    ("EM Bypass", "Kasba", "South 24 Parganas", "West Bengal", 22.5186, 88.4017),
    ("Hitech City Road", "Madhapur", "Hyderabad", "Telangana", 17.4435, 78.3772),
    ("MI Road", "Jaipur", "Jaipur", "Rajasthan", 26.9157, 75.8060),
    ("GS Road", "Guwahati", "Kamrup Metropolitan", "Assam", 26.1445, 91.7362),
    ("Janpath", "Bhubaneswar", "Khordha", "Odisha", 20.2961, 85.8245),
]


# label, material, relative frequency
WASTE_TYPES = [
    ("Bottle / Can", "plastic", 5),
    ("Plastic Bag", "plastic", 4),
    ("Chips / Snack Packet", "plastic", 3),
    ("Garbage Bag", "plastic", 1),
    ("Plastic Cup", "plastic", 1),
    ("Paper Litter", "paper", 2),
    ("Carton / Tetra Pack", "paper", 1),
]

# name, supervisor
TEAMS = [
    ("Ward Sanitation Team A", "Ward supervisor, Ward 1"),
    ("Ward Sanitation Team B", "Ward supervisor, Ward 2"),
    ("Haritha Karma Sena", "Green task force coordinator"),
    ("Municipal Solid Waste Unit", "Solid waste engineer"),
    ("Highway Maintenance Crew", "Highway section officer"),
]


# National numbers that work across India
EMERGENCY_NUMBERS = [
    ("112", "Emergency Response", "Single number for police, fire and ambulance"),
    ("100", "Police", "Illegal dumping in progress, obstruction"),
    ("101", "Fire", "Burning waste, fire near dumped material"),
    ("108", "Ambulance", "Injury or medical emergency"),
    ("1077", "District Control Room", "Disaster and public-safety incidents"),
]


# Reached through callback requests; numbers are left for the local body to fill in
DEPARTMENTS = [
    ("Local Body Sanitation Wing", "Waste collection, roadside cleaning, missed pickups", "Mon–Sat · 9:00–17:00", "tasks"),
    ("Public Health Inspector", "Waste creating health hazards, stagnant water, pests", "Mon–Sat · 9:00–17:00", "shieldCheck"),
    ("State Pollution Control Board", "Plastic burning, industrial dumping, banned plastics", "Mon–Fri · 10:00–17:00", "alert"),
    ("Road & Highway Maintenance", "Litter blocking drains or carriageway on highways", "All days · 8:00–20:00", "map"),
    ("Plastic Recycling Coordinator", "Bulk plastic pickup, recycler contacts, EPR queries", "Mon–Fri · 10:00–16:00", "recycle"),
]


FAQS = [
    (
        "How does SmartWaste AI detect plastic?",
        "Footage is analysed by YOLOE-26L, an open-vocabulary detector that finds objects described in plain "
        "words such as “snack bag” or “plastic bag”, and traces each item’s outline. Items are then "
        "followed from frame to frame so each piece of litter is counted once.",
    ),
    (
        "How accurate is the detection?",
        "No detector is perfect. On the demo footage every hand-checked item was detected and most were given "
        "the right type; flat, blurred bottles and cartons are sometimes mislabelled. Raise the minimum "
        "confidence to show only the surest detections, and treat results as a guide for field verification.",
    ),
    (
        "Why does an uploaded video play before the analysis finishes?",
        "Uploads are analysed progressively while they play. The status chip shows progress, and outlines "
        "appear for every part of the video analysed so far.",
    ),
    (
        "How is a site’s priority calculated?",
        "Priority score = uncleared items in unresolved reports + 5 × open citizen complaints + a weight for "
        "the latest report’s severity (Critical 30, High 20, Moderate 10, Low 3). Scores of 60+ are Critical, "
        "35+ High and 15+ Medium.",
    ),
    (
        "When is a report marked resolved?",
        "Assigning a cleanup task moves a report to “Cleanup assigned”. When every task linked to the report "
        "is completed, the report is resolved automatically.",
    ),
    (
        "Does footage leave this system?",
        "No. Frames are sent only to your own SmartWaste backend for analysis; no external service is used.",
    ),
]


def severity_for(total):
    if total == 0:
        return "clean"
    if total <= 5:
        return "low"
    if total <= 15:
        return "moderate"
    if total <= 30:
        return "high"
    return "critical"


class Command(BaseCommand):

    help = (
        "Load demonstration monitoring sites across India with sample "
        "reports, cleanup tasks and citizen issues. Existing data is kept "
        "unless --reset is given."
    )

    def add_arguments(self, parser):

        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete all sites, reports, tasks and issues first.",
        )

    @transaction.atomic
    def handle(self, *args, **options):

        if options["reset"]:
            CitizenIssue.objects.all().delete()
            Site.objects.all().delete()

        self.load_states()
        self.load_content()

        if Site.objects.exists():
            self.stdout.write("Sites already exist; use --reset to reload demo data.")
            return

        # Fixed seed so every reset produces the same demo data
        rng = random.Random(2026)

        now = timezone.now()

        labels = [label for label, _, weight in WASTE_TYPES for _ in range(weight)]

        materials = {label: material for label, material, _ in WASTE_TYPES}

        for index, (name, locality, district, state, lat, lng) in enumerate(SITES):

            site = Site.objects.create(
                name=name,
                locality=locality,
                district=resolve_district(state, district, lat, lng),
                latitude=lat,
                longitude=lng,
                camera_id=f"CAM-{index + 1:02d}",
            )

            # Kerala sites carry more history in the demo
            for _ in range(rng.randint(2, 4) if state == "Kerala" else rng.randint(1, 3)):

                total = rng.randint(2, 42)

                # Counted items only; demo reports have no footage timings
                found = [rng.choice(labels) for _ in range(total)]

                plastic = sum(1 for label in found if materials[label] == "plastic")

                age = timedelta(days=rng.randint(0, 29), hours=rng.randint(0, 23))

                report = Report.objects.create(
                    site=site,
                    source=rng.choice(["upload", "camera"]),
                    source_name=f"{site.camera_id} patrol footage",
                    total_items=total,
                    plastic_items=plastic,
                    severity=severity_for(total),
                    status=rng.choice(["pending", "pending", "reviewed", "resolved"]),
                )

                ReportItem.objects.bulk_create(
                    ReportItem(report=report, waste_type=label, material=materials[label])
                    for label in found
                )

                Report.objects.filter(pk=report.pk).update(created_at=now - age)

                if report.severity in ("high", "critical") and rng.random() < 0.7:

                    task_status = rng.choice(["open", "in_progress", "completed"])

                    CleanupTask.objects.create(
                        site=site,
                        report=report,
                        title=f"Clear roadside litter at {site.name}",
                        description=(
                            f"{total} items detected, {plastic} plastic. "
                            f"Collect and segregate plastic for recycling."
                        ),
                        team=FieldTeam.objects.get(name=rng.choice(TEAMS)[0]),
                        priority="critical" if report.severity == "critical" else "high",
                        status=task_status,
                        due_date=(now + timedelta(days=rng.randint(-3, 10))).date(),
                        completed_at=now if task_status == "completed" else None,
                    )

                    if report.status == "pending":
                        report.status = "resolved" if task_status == "completed" else "actioned"
                        report.save(update_fields=["status"])

        for site in rng.sample(list(Site.objects.all()), 6):

            CitizenIssue.objects.create(
                category="litter",
                site=site,
                location=f"{site.name}, {site.locality}",
                latitude=site.latitude,
                longitude=site.longitude,
                waste_type=rng.choice(["Plastic", "Mixed waste", "Plastic bags"]),
                description="Plastic waste dumped along the roadside near the bus stop.",
                status=rng.choice(["received", "assigned"]),
            )

        settings = SystemSettings.load()
        settings.default_site = Site.objects.filter(name="Kumily Road").first()
        settings.save()

        self.stdout.write(self.style.SUCCESS(
            f"Loaded {Site.objects.count()} sites, {Report.objects.count()} reports, "
            f"{CleanupTask.objects.count()} tasks and {CitizenIssue.objects.count()} issues."
        ))

    def load_states(self):

        for code, name, kind, capital, latitude, longitude in STATES:
            State.objects.update_or_create(
                code=code,
                defaults={"name": name, "kind": kind, "capital": capital, "latitude": latitude, "longitude": longitude},
            )

    def load_content(self):

        """Reference content the portal needs; only added when missing."""

        for name, supervisor in TEAMS:
            FieldTeam.objects.get_or_create(name=name, defaults={"supervisor": supervisor})

        if not HelplineContact.objects.exists():

            for order, (number, name, description) in enumerate(EMERGENCY_NUMBERS):
                HelplineContact.objects.create(
                    kind="emergency", name=name, number=number, description=description, order=order
                )

            for order, (name, description, hours, icon) in enumerate(DEPARTMENTS):
                HelplineContact.objects.create(
                    kind="department", name=name, description=description, hours=hours, icon=icon, order=order
                )

        if not FaqEntry.objects.exists():
            for order, (question, answer) in enumerate(FAQS):
                FaqEntry.objects.create(question=question, answer=answer, order=order)

        SystemSettings.load()
