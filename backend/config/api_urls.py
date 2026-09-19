from django.urls import include, path


urlpatterns = [

    path(
        "smartwaste/",
        include("apps.smartwaste.urls")
    ),

]