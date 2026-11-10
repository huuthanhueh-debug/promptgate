package com.promptgate.vision6d;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Vision 6D shell: one WebView showing the bundled web app from assets/www.
 *
 * The page is served from a fake https origin so it counts as a secure context (camera access,
 * ES modules) without any network. Every other URL is refused, and the manifest asks for no
 * INTERNET permission, so nothing can leave the device.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int REQ_CAMERA = 1;
    private static final int REQ_FILE = 2;

    private static final Map<String, String> MIME = new HashMap<String, String>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("svg", "image/svg+xml");
    }

    private WebView web;
    private PermissionRequest pendingCamera;
    private ValueCallback<Uri[]> pendingFile;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(5, 8, 13));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme();
                if (!"http".equals(scheme) && !"https".equals(scheme)) return null; // blob:, data:
                if (!"https".equals(scheme) || !HOST.equals(u.getHost())) return notFound();
                return asset(u.getPath());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost()); // never navigate away from the app
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        handleCameraRequest(request);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(pick, "Chọn ảnh"), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    pendingFile = null;
                    return false;
                }
                return true;
            }
        });

        if (state == null) web.loadUrl(START);
        else web.restoreState(state);
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
    }

    private WebResourceResponse asset(String path) {
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (path.contains("..") || path.contains("\\")) return notFound();
        int dot = path.lastIndexOf('.');
        String mime = dot < 0 ? null : MIME.get(path.substring(dot + 1).toLowerCase());
        if (mime == null) return notFound();
        try {
            InputStream in = getAssets().open("www" + path);
            return new WebResourceResponse(mime, mime.startsWith("image/png") || mime.startsWith("image/jpeg") ? null : "utf-8", in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private void handleCameraRequest(PermissionRequest request) {
        boolean wantsCamera = false;
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
        }
        if (!wantsCamera || !HOST.equals(request.getOrigin().getHost())) {
            request.deny();
            return;
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
            return;
        }
        if (pendingCamera != null) pendingCamera.deny();
        pendingCamera = request;
        requestPermissions(new String[] { Manifest.permission.CAMERA }, REQ_CAMERA);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code != REQ_CAMERA || pendingCamera == null) return;
        PermissionRequest request = pendingCamera;
        pendingCamera = null;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        } else {
            request.deny();
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != REQ_FILE || pendingFile == null) return;
        pendingFile.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        pendingFile = null;
    }

    @Override
    public void onBackPressed() {
        // The page returns true when it handled Back itself (viewer -> camera screen).
        web.evaluateJavascript("(function(){try{return !!(window.__v6dBack&&window.__v6dBack())}catch(e){return false}})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String handled) {
                    if (!"true".equals(handled)) finish();
                }
            });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    /** The only native call the page can make: save a rendered PNG. Returns a message to show. */
    private final class Bridge {
        @JavascriptInterface
        public String saveImage(String base64Png) {
            try {
                byte[] png = Base64.decode(base64Png, Base64.DEFAULT);
                if (png.length < 8 || png[0] != (byte) 0x89 || png[1] != 'P' || png[2] != 'N' || png[3] != 'G') {
                    return "Không lưu được: dữ liệu ảnh không hợp lệ.";
                }
                String name = "vision6d-" + System.currentTimeMillis() + ".png";
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Vision6D");
                    Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return "Không lưu được ảnh.";
                    OutputStream out = getContentResolver().openOutputStream(uri);
                    if (out == null) return "Không lưu được ảnh.";
                    try { out.write(png); } finally { out.close(); }
                    return "Đã lưu vào Thư viện: Pictures/Vision6D";
                }
                // Before Android 10 a shared-gallery write needs a storage permission we do not
                // ask for, so the file goes to the app's own pictures folder instead.
                File dir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
                if (dir == null) return "Không lưu được: không có bộ nhớ ngoài.";
                File f = new File(dir, name);
                FileOutputStream out = new FileOutputStream(f);
                try { out.write(png); } finally { out.close(); }
                return "Đã lưu: " + f.getAbsolutePath();
            } catch (Exception e) {
                return "Không lưu được ảnh.";
            }
        }
    }
}
