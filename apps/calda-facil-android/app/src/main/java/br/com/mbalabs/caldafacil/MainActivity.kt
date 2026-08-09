package br.com.mbalabs.caldafacil

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val startUrl = "https://www.mbalabs.com.br/calda-facil"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(5, 46, 22)
        window.navigationBarColor = Color.BLACK

        webView = WebView(this)
        webView.setBackgroundColor(Color.rgb(248, 250, 252))
        webView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
            userAgentString = "$userAgentString CaldaFacilAndroid/1.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val host = uri.host.orEmpty().lowercase()
                val isMbaLabs = host == "mbalabs.com.br" || host == "www.mbalabs.com.br" || host == "mbalabs.vercel.app"
                if (isMbaLabs) return false

                startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
            }
        }

        setContentView(webView)
        if (savedInstanceState == null) {
            webView.loadUrl(startUrl)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        webView.apply {
            loadUrl("about:blank")
            stopLoading()
            webViewClient = WebViewClient()
            destroy()
        }
        super.onDestroy()
    }
}
