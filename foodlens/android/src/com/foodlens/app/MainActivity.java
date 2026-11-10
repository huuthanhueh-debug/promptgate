package com.foodlens.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

/**
 * Thin shell around the bundled web app (assets/web). It adds the three things a WebView does
 * not do by itself: the camera/gallery picker behind &lt;input type="file"&gt;, HTTPS calls to the
 * Claude API without browser CORS rules, and the hardware back button.
 */
public class MainActivity extends Activity {
    private static final String HOME = "file:///android_asset/web/index.html";
    private static final String API_PREFIX = "https://api.anthropic.com/";
    private static final int PICK_IMAGE = 41;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xFF0F8F5C);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // The app is one bundled page; anything else is not loaded inside it.
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return openPicker(callback, params.isCaptureEnabled());
            }
        });
        web.addJavascriptInterface(new Bridge(), "FoodLensNative");
        web.loadUrl(HOME);
    }

    private boolean openPicker(ValueCallback<Uri[]> callback, boolean cameraOnly) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = callback;
        cameraUri = null;

        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, "foodlens_" + System.currentTimeMillis() + ".jpg");
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        } catch (RuntimeException e) {
            cameraUri = null;
        }
        if (cameraUri != null) {
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            camera.setClipData(ClipData.newRawUri("photo", cameraUri));
            camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }

        Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
        gallery.addCategory(Intent.CATEGORY_OPENABLE);
        gallery.setType("image/*");

        Intent launch;
        if (cameraOnly && cameraUri != null) {
            launch = camera;
        } else {
            launch = Intent.createChooser(gallery, "Chọn ảnh món ăn");
            if (cameraUri != null) launch.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { camera });
        }
        try {
            startActivityForResult(launch, PICK_IMAGE);
        } catch (RuntimeException noCameraApp) {
            try {
                startActivityForResult(Intent.createChooser(gallery, "Chọn ảnh món ăn"), PICK_IMAGE);
            } catch (RuntimeException e) {
                finishPick(null);
            }
        }
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_IMAGE) return;
        Uri result = null;
        if (resultCode == RESULT_OK) {
            result = data != null && data.getData() != null ? data.getData() : cameraUri;
        }
        finishPick(result);
    }

    /** Hands the picked image to the page and removes the empty gallery row when the camera was not used. */
    private void finishPick(Uri result) {
        if (cameraUri != null && !cameraUri.equals(result)) {
            try {
                getContentResolver().delete(cameraUri, null, null);
            } catch (RuntimeException ignored) {
                // Nothing to clean up.
            }
        }
        cameraUri = null;
        if (fileCallback != null) {
            fileCallback.onReceiveValue(result == null ? null : new Uri[] { result });
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.__flBack && window.__flBack()) ? 1 : 0", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"1".equals(handled)) finish();
            }
        });
    }

    @Override
    protected void onDestroy() {
        WebView closing = web;
        web = null;
        closing.removeJavascriptInterface("FoodLensNative");
        closing.destroy();
        super.onDestroy();
    }

    /** JS-callable HTTPS POST, limited to the Claude API host. The page gets the answer through window.__flNative. */
    private final class Bridge {
        @JavascriptInterface
        public void post(final String id, final String url, final String headersJson, final String body) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    int status = 0;
                    String text = "";
                    HttpURLConnection conn = null;
                    try {
                        if (url == null || !url.startsWith(API_PREFIX)) throw new SecurityException("host not allowed");
                        conn = (HttpURLConnection) new URL(url).openConnection();
                        conn.setRequestMethod("POST");
                        conn.setConnectTimeout(20000);
                        conn.setReadTimeout(120000);
                        conn.setDoOutput(true);
                        JSONObject headers = new JSONObject(headersJson == null ? "{}" : headersJson);
                        for (Iterator<String> it = headers.keys(); it.hasNext();) {
                            String name = it.next();
                            conn.setRequestProperty(name, headers.getString(name));
                        }
                        byte[] payload = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
                        conn.setFixedLengthStreamingMode(payload.length);
                        try (OutputStream out = conn.getOutputStream()) {
                            out.write(payload);
                        }
                        status = conn.getResponseCode();
                        InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                        text = in == null ? "" : readAll(in);
                    } catch (Exception e) {
                        status = 0;
                        text = "";
                    } finally {
                        if (conn != null) conn.disconnect();
                    }
                    final String js = "window.__flNative(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(text) + ")";
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (web != null) web.evaluateJavascript(js, null);
                        }
                    });
                }
            }).start();
        }
    }

    private static String readAll(InputStream in) throws java.io.IOException {
        try (InputStream src = in) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = src.read(chunk)) > 0) buf.write(chunk, 0, n);
            return new String(buf.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
