# Settings are stored as JSON via kotlinx.serialization; keep the model intact.
-keep class app.foldisland.settings.AppConfig { *; }
-keep class app.foldisland.settings.Place { *; }
-keep class app.foldisland.settings.QuickContact { *; }
-keep class app.foldisland.settings.Reminder { *; }
-keep class app.foldisland.settings.Tuning { *; }
-keep class app.foldisland.settings.IdleStyle { *; }
-keepclassmembers class app.foldisland.settings.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
