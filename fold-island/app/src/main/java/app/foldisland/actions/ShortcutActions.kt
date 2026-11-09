package app.foldisland.actions

import android.Manifest
import android.app.ActivityOptions
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.net.toUri
import app.foldisland.core.GrabLink
import app.foldisland.settings.MainActivity
import app.foldisland.settings.Place
import app.foldisland.settings.QuickContact

/** Everything the island can launch. All methods are safe to call from the overlay service. */
object ShortcutActions {

    private const val TAG = "FoldIsland"

    /** Opens Grab on the booking screen with [place] as drop-off; falls back step by step. */
    fun bookGrab(context: Context, place: Place, template: String) {
        val link = GrabLink.build(template, place.lat, place.lng, place.name)
        val deepLink = Intent(Intent.ACTION_VIEW, link.toUri())
            .setPackage(GrabLink.PACKAGE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (start(context, deepLink)) return
        if (launchApp(context, GrabLink.PACKAGE)) return
        start(
            context,
            Intent(Intent.ACTION_VIEW, "market://details?id=${GrabLink.PACKAGE}".toUri())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    /** Calls directly when allowed, otherwise opens the dialer with the number filled in. */
    fun call(context: Context, contact: QuickContact) {
        val uri = Uri.fromParts("tel", contact.phone, null)
        val canCall = context.checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        val intent = Intent(if (canCall) Intent.ACTION_CALL else Intent.ACTION_DIAL, uri)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (!start(context, intent) && canCall) {
            start(context, Intent(Intent.ACTION_DIAL, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    fun launchApp(context: Context, packageName: String): Boolean {
        val intent = context.packageManager.getLaunchIntentForPackage(packageName) ?: return false
        return start(context, intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun openSettings(context: Context) {
        start(
            context,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        )
    }

    /** Opens the source app's own screen for a notification-backed item. */
    fun openSource(context: Context, contentIntent: PendingIntent?, packageName: String?) {
        if (contentIntent != null && send(context, contentIntent)) return
        if (packageName != null) launchApp(context, packageName)
    }

    /** Fires another app's PendingIntent, allowing it to bring up an activity. */
    fun send(context: Context, pendingIntent: PendingIntent): Boolean = try {
        val options = ActivityOptions.makeBasic().apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
                setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOW_ALWAYS)
            } else {
                @Suppress("DEPRECATION")
                setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
            }
        }.toBundle()
        pendingIntent.send(context, 0, null, null, null, null, options)
        true
    } catch (e: PendingIntent.CanceledException) {
        Log.w(TAG, "PendingIntent was cancelled", e)
        false
    }

    private fun start(context: Context, intent: Intent): Boolean = try {
        context.startActivity(intent)
        true
    } catch (e: ActivityNotFoundException) {
        false
    } catch (e: SecurityException) {
        Log.w(TAG, "Not allowed to start $intent", e)
        false
    }
}
