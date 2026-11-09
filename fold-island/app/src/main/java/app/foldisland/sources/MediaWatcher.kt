package app.foldisland.sources

import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import app.foldisland.core.LiveItem
import app.foldisland.hub.ActivityHub
import app.foldisland.hub.Handles

/**
 * Follows the phone's media sessions (Spotify, YouTube Music, Zing MP3, ...). Needs the
 * notification-listener permission, which is why it is started by the listener.
 */
class MediaWatcher(private val context: Context) {

    private val manager = context.getSystemService(MediaSessionManager::class.java)
    private val component = ComponentName(context, IslandNotificationListener::class.java)
    private val handler = Handler(Looper.getMainLooper())
    private val callbacks = HashMap<MediaController, MediaController.Callback>()

    private val sessionsListener = MediaSessionManager.OnActiveSessionsChangedListener { list ->
        track(list.orEmpty())
    }

    fun start() {
        runCatching {
            manager.addOnActiveSessionsChangedListener(sessionsListener, component, handler)
            track(manager.getActiveSessions(component))
        }
    }

    fun stop() {
        runCatching { manager.removeOnActiveSessionsChangedListener(sessionsListener) }
        callbacks.forEach { (c, cb) -> c.unregisterCallback(cb) }
        callbacks.clear()
        ActivityHub.removeIf { it is LiveItem.Media }
    }

    private fun track(controllers: List<MediaController>) {
        callbacks.keys.filter { old -> controllers.none { it.sessionToken == old.sessionToken } }.forEach {
            it.unregisterCallback(callbacks.remove(it)!!)
        }
        controllers.filter { c -> callbacks.keys.none { it.sessionToken == c.sessionToken } }.forEach { c ->
            val cb = object : MediaController.Callback() {
                override fun onPlaybackStateChanged(state: PlaybackState?) = publish()
                override fun onMetadataChanged(metadata: MediaMetadata?) = publish()
                override fun onSessionDestroyed() = publish()
            }
            c.registerCallback(cb, handler)
            callbacks[c] = cb
        }
        publish()
    }

    private fun publish() {
        val now = System.currentTimeMillis()
        val controllers = callbacks.keys.toList()
        val chosen = controllers.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING }
            ?: controllers.maxByOrNull { it.playbackState?.lastPositionUpdateTime ?: 0L }
        ActivityHub.removeIf { it is LiveItem.Media && it.id != chosen?.let(::idFor) }
        if (chosen == null) return
        val meta = chosen.metadata
        val title = meta?.getString(MediaMetadata.METADATA_KEY_TITLE).orEmpty()
        if (title.isBlank()) {
            ActivityHub.remove(idFor(chosen))
            return
        }
        val playing = chosen.playbackState?.state == PlaybackState.STATE_PLAYING
        val previous = ActivityHub.get(idFor(chosen)) as? LiveItem.Media
        val item = LiveItem.Media(
            id = idFor(chosen),
            sourcePackage = chosen.packageName,
            postedAt = if (previous != null && previous.title == title) previous.postedAt else now,
            title = title,
            artist = meta?.getString(MediaMetadata.METADATA_KEY_ARTIST)
                ?: meta?.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST).orEmpty(),
            playing = playing,
            expiresAt = if (playing) null else (previous?.expiresAt?.takeIf { previous.playing.not() }
                ?: (now + PAUSED_GRACE_MS)),
        )
        ActivityHub.put(
            item,
            Handles(contentIntent = chosen.sessionActivity, largeImage = art(meta), media = chosen),
        )
    }

    private fun art(meta: MediaMetadata?): Bitmap? = meta?.let {
        it.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: it.getBitmap(MediaMetadata.METADATA_KEY_ART)
            ?: it.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
    }

    private fun idFor(c: MediaController) = "media:${c.packageName}"

    companion object {
        const val PAUSED_GRACE_MS = 30_000L
    }
}
