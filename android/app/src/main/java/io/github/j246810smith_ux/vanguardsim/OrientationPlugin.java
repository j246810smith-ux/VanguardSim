package io.github.j246810smith_ux.vanguardsim;

import android.content.pm.ActivityInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Portrait mode during battles (docs/android/PORTRAIT_PLAN.md): the app is landscape
 * (AndroidManifest: sensorLandscape) except while a battle is on screen, when it follows the
 * phone's sensor so it can be held upright. The activity handles the rotation itself
 * (configChanges includes orientation and screenSize), so the game is never restarted.
 */
@CapacitorPlugin(name = "Orientation")
public class OrientationPlugin extends Plugin {

    /** mode: "any" (follow the sensor, portrait included) or "landscape". */
    @PluginMethod
    public void set(PluginCall call) {
        String mode = call.getString("mode", "landscape");
        int requested = "any".equals(mode)
            ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER
            : ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        getActivity().runOnUiThread(() -> {
            getActivity().setRequestedOrientation(requested);
            JSObject ret = new JSObject();
            ret.put("mode", mode);
            call.resolve(ret);
        });
    }
}
