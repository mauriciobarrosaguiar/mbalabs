package br.com.mbalabs.igreja;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Scanner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://www.mbalabs.com.br/elshaday";
    private static final String UPDATE_URL = "https://www.mbalabs.com.br/api/elshaday/app/version";
    private WebView webView;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileChooserCallback;
    private static final int FILE_CHOOSER_REQUEST = 8001;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progress = findViewById(R.id.progress);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " IgrejaAndroid/1.0.0");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.equals("www.mbalabs.com.br") || host.equals("mbalabs.com.br"))) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    Toast.makeText(MainActivity.this, "Não foi possível abrir este link.", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException e) {
                    fileChooserCallback = null;
                    Toast.makeText(MainActivity.this, "Nenhum aplicativo disponível para selecionar arquivo.", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }

        checkForUpdate();
    }

    private void checkForUpdate() {
        new Thread(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(UPDATE_URL).openConnection();
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                conn.setRequestProperty("Accept", "application/json");
                if (conn.getResponseCode() != 200) return;

                String body;
                try (Scanner scanner = new Scanner(conn.getInputStream()).useDelimiter("\\A")) {
                    body = scanner.hasNext() ? scanner.next() : "";
                }

                int latestCode = extractInt(body, "versionCode", 1);
                String latestName = extractString(body, "versionName", "");
                String apkUrl = extractString(body, "apkUrl", "");
                boolean required = extractBoolean(body, "required", false);
                long currentCode = getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();

                if (latestCode > currentCode && !apkUrl.isEmpty()) {
                    runOnUiThread(() -> showUpdateDialog(latestName, apkUrl, required));
                }
            } catch (Exception ignored) {
                // O aplicativo continua funcionando normalmente se a checagem estiver indisponível.
            }
        }).start();
    }

    private void showUpdateDialog(String version, String apkUrl, boolean required) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this)
                .setTitle("Nova atualização disponível")
                .setMessage(version.isEmpty() ? "Existe uma nova versão do aplicativo." : "Versão " + version + " disponível.")
                .setPositiveButton("Atualizar", (dialog, which) -> {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl)));
                    } catch (Exception e) {
                        Toast.makeText(this, "Não foi possível abrir a atualização.", Toast.LENGTH_SHORT).show();
                    }
                });
        if (!required) builder.setNegativeButton("Depois", null);
        builder.setCancelable(!required).show();
    }

    private static int extractInt(String json, String key, int fallback) {
        Matcher m = Pattern.compile("\\\"" + Pattern.quote(key) + "\\\"\\s*:\\s*(\\d+)").matcher(json);
        return m.find() ? Integer.parseInt(m.group(1)) : fallback;
    }

    private static boolean extractBoolean(String json, String key, boolean fallback) {
        Matcher m = Pattern.compile("\\\"" + Pattern.quote(key) + "\\\"\\s*:\\s*(true|false)").matcher(json);
        return m.find() ? Boolean.parseBoolean(m.group(1)) : fallback;
    }

    private static String extractString(String json, String key, String fallback) {
        Matcher m = Pattern.compile("\\\"" + Pattern.quote(key) + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"").matcher(json);
        return m.find() ? m.group(1).replace("\\/", "/") : fallback;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileChooserCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileChooserCallback.onReceiveValue(results);
            fileChooserCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
