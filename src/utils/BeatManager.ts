// src/utils/BeatManager.ts

/**
 * A lightweight utility to synchronize visual effects with audio. 
 * It monitors a Phaser Sound instance and triggers callbacks based on 
 * BPM (recurring beats) or specific time markers (one-off cues).
 */
export class BeatManager {
    private sound: Phaser.Sound.BaseSound | null = null;
    private bpm: number = 0;
    private lastBeatIndex: number = -1;
    private cues: Array<{ time: number, callback: () => void, fired: boolean }> = [];
    private onBeatCallback: ((beatIndex: number) => void) | null = null;

    /**
     * Start monitoring a sound
     * @param sound The Phaser sound instance to track
     * @param bpm Beats per minute for recurring pulses (optional)
     */
    public start(sound: Phaser.Sound.BaseSound, bpm: number = 0) {
        this.sound = sound;
        this.bpm = bpm;
        this.lastBeatIndex = -1;
        this.resetCues();
    }

    /**
     * Stop monitoring
     */
    public stop() {
        this.sound = null;
        this.bpm = 0;
    }

    /**
     * Set a callback for every beat (based on BPM)
     */
    public onBeat(callback: (beatIndex: number) => void) {
        this.onBeatCallback = callback;
    }

    /**
     * Add a one-time cue at a specific second
     */
    public addCue(seconds: number, callback: () => void) {
        this.cues.push({ time: seconds, callback, fired: false });
    }

    /**
     * Mark all cues as not fired (useful for looping tracks)
     */
    public resetCues() {
        this.cues.forEach(c => c.fired = false);
    }

    /**
     * Must be called in the Scene's update() loop
     */
    public update() {
        if (!this.sound || !this.sound.isPlaying) return;

        // Phaser seek is in seconds
        const currentTime = (this.sound as any).seek || 0;

        // Handle recurring BPM beats
        if (this.bpm > 0 && this.onBeatCallback) {
            const beatGap = 60 / this.bpm;
            const currentBeatIndex = Math.floor(currentTime / beatGap);

            if (currentBeatIndex > this.lastBeatIndex) {
                this.onBeatCallback(currentBeatIndex);
                this.lastBeatIndex = currentBeatIndex;
            } else if (currentBeatIndex < this.lastBeatIndex) {
                // Audio likely looped or restarted
                this.lastBeatIndex = currentBeatIndex;
            }
        }

        // Handle discrete cues
        for (const cue of this.cues) {
            if (!cue.fired && currentTime >= cue.time) {
                cue.callback();
                cue.fired = true;
            }
        }
    }
}
