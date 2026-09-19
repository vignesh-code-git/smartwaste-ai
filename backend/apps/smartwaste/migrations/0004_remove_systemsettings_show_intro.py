from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("smartwaste", "0003_fieldteam_systemsettings_helplinecontact_faqentry"),
    ]

    operations = [
        migrations.RemoveField(model_name="systemsettings", name="show_intro"),
    ]
