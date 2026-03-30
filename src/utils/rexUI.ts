// src/scripts/rexUI.ts
// This is just a re-export of the RexUI plugin

// Import the plugin from the CDN
import rexUIPlugin from './rexuiplugin.min.js';
import rexToggleSwitchPlugin from './rextoggleswitch.min.js';

// Export both plugins
export default {
    UI: rexUIPlugin,
    ToggleSwitch: rexToggleSwitchPlugin
};