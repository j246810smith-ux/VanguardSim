package io.github.j246810smith_ux.vanguardsim;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Selectable app icons (Settings -> App icon; app/renderer/appIcons.ts and appIconNative.ts).
 * Each icon is an activity-alias in AndroidManifest.xml; choosing one enables its alias and
 * disables the others, so the launcher and app drawer show that icon. Android keeps the enabled
 * alias across restarts and app updates. Some launchers take a few seconds to redraw the icon,
 * and home-screen shortcuts made from an old icon may be removed by the launcher.
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    private static final String[][] ICONS = {
        { "classic", ".IconClassic" },
        { "blaster_blade", ".IconBlasterBlade" },
        { "overdress", ".IconOverDress" },
        { "g_era", ".IconGEra" },
        { "cfs", ".IconCfs" },
    };

    private ComponentName component(String alias) {
        return new ComponentName(getContext().getPackageName(), getContext().getPackageName() + alias);
    }

    private boolean enabled(PackageManager pm, String alias, boolean isDefault) {
        int state = pm.getComponentEnabledSetting(component(alias));
        if (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) return isDefault;
        return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }

    @PluginMethod
    public void get(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String current = "classic";
        for (String[] icon : ICONS) {
            if (enabled(pm, icon[1], icon[0].equals("classic"))) {
                current = icon[0];
                break;
            }
        }
        JSObject ret = new JSObject();
        ret.put("id", current);
        call.resolve(ret);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String id = call.getString("id", "classic");
        boolean known = false;
        for (String[] icon : ICONS) if (icon[0].equals(id)) known = true;
        if (!known) id = "classic";
        PackageManager pm = getContext().getPackageManager();
        // enable the chosen alias first, so there is never a moment with no launcher entry
        for (String[] icon : ICONS) {
            if (!icon[0].equals(id)) continue;
            if (!enabled(pm, icon[1], icon[0].equals("classic"))) pm.setComponentEnabledSetting(
                component(icon[1]),
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            );
        }
        for (String[] icon : ICONS) {
            if (icon[0].equals(id)) continue;
            if (enabled(pm, icon[1], icon[0].equals("classic"))) pm.setComponentEnabledSetting(
                component(icon[1]),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            );
        }
        JSObject ret = new JSObject();
        ret.put("id", id);
        call.resolve(ret);
    }
}
