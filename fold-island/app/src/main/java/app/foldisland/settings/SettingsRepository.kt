package app.foldisland.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.first

private val Context.dataStore by preferencesDataStore(name = "fold_island")
private val CONFIG_KEY = stringPreferencesKey("config_json")

/** Single source of truth for [AppConfig]. One instance per process (see IslandApp). */
class SettingsRepository(private val context: Context, scope: CoroutineScope) {

    val config: StateFlow<AppConfig> = context.dataStore.data
        .map { prefs -> AppConfig.decode(prefs[CONFIG_KEY]) }
        .stateIn(scope, SharingStarted.Eagerly, initialBlocking())

    suspend fun update(transform: (AppConfig) -> AppConfig) {
        context.dataStore.edit { prefs ->
            val current = AppConfig.decode(prefs[CONFIG_KEY])
            prefs[CONFIG_KEY] = AppConfig.encode(transform(current))
        }
    }

    // Read once synchronously so services never start with defaults that overwrite the
    // user's real settings (e.g. reminders rescheduled at boot). DataStore read is tiny.
    private fun initialBlocking(): AppConfig = runBlocking {
        AppConfig.decode(context.dataStore.data.first()[CONFIG_KEY])
    }
}
