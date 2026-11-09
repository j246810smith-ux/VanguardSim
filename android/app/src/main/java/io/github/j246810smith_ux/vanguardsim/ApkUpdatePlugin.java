package io.github.j246810smith_ux.vanguardsim;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;

/**
 * Updating the app from inside it (Settings -> Updates; app/renderer/android/apkUpdate.ts).
 * download: fetches a release APK from the official GitHub releases into the app's private cache,
 * checks its SHA-256 (from GitHub's release list), that it is this app, newer, and signed with the
 * same key as the installed copy. install: hands it to Android's own installer, which asks the
 * player to confirm. Android itself refuses an APK signed with another key, so a changed file can
 * never replace the game.
 */
@CapacitorPlugin(name = "ApkUpdate")
public class ApkUpdatePlugin extends Plugin {

    private static final long MAX_BYTES = 200L * 1024 * 1024;
    private static final String FILE_NAME = "update.apk";

    /** Release downloads only: GitHub, and the storage hosts GitHub redirects downloads to. */
    private static boolean allowedHost(URL url) {
        if (!"https".equals(url.getProtocol())) return false;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("github.com") || host.endsWith(".githubusercontent.com");
    }

    private File target() {
        File dir = new File(getContext().getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, FILE_NAME);
    }

    @PluginMethod
    public void download(PluginCall call) {
        String address = call.getString("url", "");
        String sha256 = call.getString("sha256", "");
        new Thread(() -> {
            File out = target();
            File part = new File(out.getPath() + ".part");
            try {
                URL url = new URL(address);
                HttpURLConnection conn = null;
                // follow redirects by hand, so every hop is checked against the allowed hosts
                for (int hop = 0; hop < 5; hop++) {
                    if (!allowedHost(url)) throw new Exception("not an official download address");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "VanguardSim-Updater");
                    int code = conn.getResponseCode();
                    if (code >= 300 && code < 400) {
                        String next = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (next == null) throw new Exception("redirect without an address");
                        url = new URL(url, next);
                        continue;
                    }
                    if (code != 200) throw new Exception("GitHub answered " + code);
                    break;
                }
                if (conn == null) throw new Exception("too many redirects");
                long total = conn.getContentLengthLong();
                if (total > MAX_BYTES) throw new Exception("the download is too large");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long done = 0;
                long lastReport = 0;
                try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(part)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        done += n;
                        if (done > MAX_BYTES) throw new Exception("the download is too large");
                        digest.update(buf, 0, n);
                        fos.write(buf, 0, n);
                        if (done - lastReport > 256 * 1024) {
                            lastReport = done;
                            JSObject p = new JSObject();
                            p.put("done", done);
                            p.put("total", total);
                            notifyListeners("progress", p);
                        }
                    }
                } finally {
                    conn.disconnect();
                }
                if (!sha256.isEmpty()) {
                    String got = hex(digest.digest());
                    if (!got.equalsIgnoreCase(sha256)) throw new Exception("the download is damaged (checksum differs)");
                }
                String version = check(part);
                if (out.exists()) //noinspection ResultOfMethodCallIgnored
                    out.delete();
                if (!part.renameTo(out)) throw new Exception("could not save the download");
                JSObject ret = new JSObject();
                ret.put("version", version);
                ret.put("bytes", done);
                call.resolve(ret);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                part.delete();
                call.reject(e.getMessage() == null ? "download failed" : e.getMessage());
            }
        }).start();
    }

    /** The APK is this app, newer than the installed copy, and signed with the same key. */
    private String check(File apk) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo apkInfo = pm.getPackageArchiveInfo(apk.getPath(), flags);
        if (apkInfo == null) throw new Exception("the download is not an Android app");
        if (!pkg.equals(apkInfo.packageName)) throw new Exception("the download is a different app");
        PackageInfo mine = pm.getPackageInfo(pkg, flags);
        long apkCode = Build.VERSION.SDK_INT >= 28 ? apkInfo.getLongVersionCode() : apkInfo.versionCode;
        long myCode = Build.VERSION.SDK_INT >= 28 ? mine.getLongVersionCode() : mine.versionCode;
        if (apkCode <= myCode) throw new Exception("the download is not newer than this copy");
        Signature[] a = signatures(apkInfo);
        Signature[] b = signatures(mine);
        // where Android gives no signatures for a file, its installer still checks them itself
        if (a != null && b != null && a.length > 0 && b.length > 0 && !Arrays.equals(a, b))
            throw new Exception("the download is not signed by the game's key");
        return apkInfo.versionName;
    }

    @SuppressWarnings("deprecation")
    private static Signature[] signatures(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= 28) {
            if (info.signingInfo == null) return null;
            return info.signingInfo.hasMultipleSigners()
                ? info.signingInfo.getApkContentsSigners()
                : info.signingInfo.getSigningCertificateHistory();
        }
        return info.signatures;
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte x : bytes) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    /** Whether Android lets this app open the installer (Install unknown apps, Android 8+). */
    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean ok = Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject ret = new JSObject();
        ret.put("allowed", ok);
        call.resolve(ret);
    }

    /** Opens Settings -> Install unknown apps for this app. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    /** Hands the downloaded APK to Android's installer; the player confirms there. */
    @PluginMethod
    public void install(PluginCall call) {
        File apk = target();
        if (!apk.exists()) {
            call.reject("nothing downloaded");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
