package app.foldisland

import android.app.Application
import app.foldisland.settings.SettingsRepository
import app.foldisland.sources.Reminders
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

class IslandApp : Application() {

    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    lateinit var settings: SettingsRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        settings = SettingsRepository(this, appScope)
        Reminders.createChannel(this)
        // Keep alarms in sync with the reminder list every time the process starts or it changes.
        appScope.launch {
            settings.config.map { it.reminders }.distinctUntilChanged().collect {
                Reminders.scheduleAll(this@IslandApp, it)
            }
        }
    }

    companion object {
        lateinit var instance: IslandApp
            private set
    }
}
