package com.youjie.metronome;

import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 应用在前台时保持亮屏，不更改手机全局设置，也不阻止用户手动锁屏。 */
@CapacitorPlugin(name = "TrainingScreen")
public class TrainingScreenPlugin extends Plugin {
    private boolean foreground = false;
    private boolean settingsOpen = false;

    @PluginMethod
    public void setSettingsOpen(PluginCall call) {
        final boolean open = Boolean.TRUE.equals(call.getBoolean("open", false));
        getActivity().runOnUiThread(() -> { settingsOpen = open; call.resolve(); });
    }

    public boolean closeSettingsIfOpen() {
        if (!settingsOpen) return false;
        settingsOpen = false;
        notifyListeners("closeSettings", new JSObject());
        return true;
    }

    private void applyScreenState() {
        if (foreground) {
            getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private JSObject currentState() {
        JSObject result = new JSObject();
        boolean active = (getActivity().getWindow().getAttributes().flags
                & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) != 0;
        result.put("active", active);
        result.put("foreground", foreground);
        return result;
    }

    @PluginMethod
    public void getState(PluginCall call) {
        getActivity().runOnUiThread(() -> call.resolve(currentState()));
    }

    @Override
    protected void handleOnResume() {
        foreground = true;
        applyScreenState();
        notifyListeners("appResumed", currentState());
    }

    @Override
    protected void handleOnPause() {
        foreground = false;
        applyScreenState();
        notifyListeners("appPaused", new JSObject());
    }

    @Override
    protected void handleOnDestroy() {
        foreground = false;
        applyScreenState();
    }
}
