from django.urls import path
from rest_framework.routers import DefaultRouter

from .data_views import (
    CitizenIssueViewSet,
    CleanupTaskViewSet,
    DistrictViewSet,
    FaqEntryViewSet,
    FieldTeamViewSet,
    GlobalSearchView,
    HelplineContactViewSet,
    IssueStatusView,
    OverviewView,
    PlaceSearchView,
    ReportViewSet,
    SettingsView,
    SiteViewSet,
    StateViewSet,
)
from .views import (
    FrameDetectionView,
    HealthCheckView,
)


router = DefaultRouter(trailing_slash=True)

router.register("states", StateViewSet, basename="state")

router.register("districts", DistrictViewSet, basename="district")

router.register("sites", SiteViewSet, basename="site")

router.register("reports", ReportViewSet, basename="report")

router.register("tasks", CleanupTaskViewSet, basename="task")

router.register("issues", CitizenIssueViewSet, basename="issue")

router.register("teams", FieldTeamViewSet, basename="team")

router.register("helplines", HelplineContactViewSet, basename="helpline")

router.register("faqs", FaqEntryViewSet, basename="faq")


urlpatterns = [

    path(
        "health/",
        HealthCheckView.as_view(),
        name="health",
    ),

    path(
        "detect-frame/",
        FrameDetectionView.as_view(),
        name="detect-frame",
    ),

    path(
        "settings/",
        SettingsView.as_view(),
        name="settings",
    ),

    path(
        "overview/",
        OverviewView.as_view(),
        name="overview",
    ),

    path(
        "search/",
        GlobalSearchView.as_view(),
        name="search",
    ),

    path(
        "places/search/",
        PlaceSearchView.as_view(),
        name="place-search",
    ),

    path(
        "issues/track/<str:reference>/",
        IssueStatusView.as_view(),
        name="issue-track",
    ),

    *router.urls,

]
