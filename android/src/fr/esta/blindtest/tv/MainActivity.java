package fr.esta.blindtest.tv;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Blind test – Écran : affiche l'écran géant en plein écran sur un dongle Android TV.
 * Télécommande :
 *  - OK : recharger l'écran
 *  - OK 5 fois de suite (ou touche Menu) : basculer vraie soirée / mode essai
 *  - Retour 2 fois : quitter
 */
public class MainActivity extends Activity {
    static final String BASE = "https://blindtest.dam-cigogne.workers.dev";

    private WebView web;
    private SharedPreferences prefs;
    private long lastBack = 0;
    private long lastOk = 0;
    private int okCount = 0;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        prefs = getSharedPreferences("blindtest", MODE_PRIVATE);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(0xFF140C29);
        setContentView(web);
        hideBars();
        load();
    }

    private boolean essai() {
        return prefs.getBoolean("essai", false);
    }

    private void load() {
        web.loadUrl(BASE + (essai() ? "/ecran-essai" : "/ecran"));
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private void hideBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void toggleEssai() {
        boolean e = !essai();
        prefs.edit().putBoolean("essai", e).apply();
        toast(e ? "🧪 Mode ESSAI" : "🎵 Vraie soirée");
        load();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        long now = System.currentTimeMillis();
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            toggleEssai();
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
            okCount = (now - lastOk < 1500) ? okCount + 1 : 1;
            lastOk = now;
            if (okCount >= 5) {
                okCount = 0;
                toggleEssai();
            } else if (okCount == 1) {
                toast("↻ Écran rechargé" + (essai() ? " (mode essai)" : ""));
                load();
            }
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (now - lastBack < 2500) {
                finish();
            } else {
                lastBack = now;
                toast("Appuyez encore sur Retour pour quitter");
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideBars();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }
}
