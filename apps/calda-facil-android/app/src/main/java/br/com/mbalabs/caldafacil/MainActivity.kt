package br.com.mbalabs.caldafacil

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
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
        webView.setBackgroundColor(Color.rgb(251, 250, 243))
        webView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true

            // Mantém o mesmo tamanho/escala visual da versão aberta no navegador.
            textZoom = 100
            useWideViewPort = true
            loadWithOverviewMode = false

            // Alguns aparelhos Samsung aplicam escurecimento automático ao WebView.
            // Isso alterava os cards claros para azul-marinho sem adaptar todo o texto.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                @Suppress("DEPRECATION")
                forceDark = WebSettings.FORCE_DARK_OFF
            }

            userAgentString = "$userAgentString CaldaFacilAndroid/1.1"
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
