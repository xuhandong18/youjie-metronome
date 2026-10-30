package com.youjie.metronome;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TrainingScreenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
