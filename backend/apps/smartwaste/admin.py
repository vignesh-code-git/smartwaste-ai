from django.contrib import admin

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


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "kind", "capital"]
    list_filter = ["kind"]
    search_fields = ["name", "code"]


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ["name", "state"]
    list_filter = ["state"]
    search_fields = ["name"]


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ["name", "district", "camera_id", "is_active"]
    list_filter = ["district__state", "is_active"]
    search_fields = ["name", "locality", "district__name"]
    list_select_related = ["district__state"]


class ReportItemInline(admin.TabularInline):
    model = ReportItem
    extra = 0


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["id", "site", "total_items", "plastic_items", "severity", "status", "created_at"]
    list_filter = ["severity", "status", "source"]
    list_select_related = ["site__district"]
    inlines = [ReportItemInline]


@admin.register(CleanupTask)
class CleanupTaskAdmin(admin.ModelAdmin):
    list_display = ["title", "site", "team", "priority", "status", "due_date"]
    list_filter = ["status", "priority", "team"]
    list_select_related = ["site__district", "team"]


@admin.register(CitizenIssue)
class CitizenIssueAdmin(admin.ModelAdmin):
    list_display = ["reference", "category", "location", "status", "created_at"]
    list_filter = ["category", "status"]
    search_fields = ["reference", "location", "name"]


@admin.register(FieldTeam)
class FieldTeamAdmin(admin.ModelAdmin):
    list_display = ["name", "supervisor", "phone", "is_active"]


@admin.register(HelplineContact)
class HelplineContactAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "number", "hours", "order"]
    list_filter = ["kind"]


@admin.register(FaqEntry)
class FaqEntryAdmin(admin.ModelAdmin):
    list_display = ["question", "order"]


admin.site.register(SystemSettings)
