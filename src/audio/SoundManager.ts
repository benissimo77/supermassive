// src/audio/SoundManager.ts
import { BaseScene } from 'src/BaseScene';
import { Sound } from 'phaser';

// Extend Phaser's Sound types to include missing methods
declare module 'phaser' {
    namespace Sound {
        interface BaseSound {
            setVolume(value: number): this;
            setMute(value: boolean): this;
            volume: number;
        }
    }
}

export interface Track {
    key: string;
    config?: Phaser.Types.Sound.SoundConfig;
    marker?: string;
    category: 'music' | 'sfx' | 'voice';
    fadeIn?: number;
    fadeOut?: number;
    loop?: boolean;
    volume?: number;
    sound?: Phaser.Sound.BaseSound;
}

export class SoundManager {
    private static instance: SoundManager;

    private scene: BaseScene;
    private tracks: Map<string, Track> = new Map();
    private currentMusic: string | null = null;
    private queuedMusic: string | null = null;
    private isCrossFading: boolean = false;
    private youtubePlayer: any = null;

    // Volume levels per category
    private volumeLevels = {
        master: 1.0,
        music: 0.7,
        sfx: 1.0,
        voice: 1.0
    };

    private muted = {
        master: false,
        music: false,
        sfx: false,
        voice: false
    };

    private constructor(scene: BaseScene) {
        this.scene = scene;
    }

    // Static method to get the single instance
    static getInstance(scene?: BaseScene): SoundManager {
        if (!SoundManager.instance) {
            if (!scene) {
                throw new Error("SoundManager requires a scene for first initialization");
            }
            SoundManager.instance = new SoundManager(scene);
        } else if (scene) {
            SoundManager.instance.scene = scene;
        }
        return SoundManager.instance;
    }

    /**
     * Play a sound effect once
     */
    playSfx(key: string, volume: number = 1.0): void {
        if (this.muted.master || this.muted.sfx) return;

        const actualVolume = volume * this.volumeLevels.master * this.volumeLevels.sfx;
        this.scene.sound.play(key, { volume: actualVolume });
    }

    /**
     * Play or change background music with optional crossfade
     */
    playMusic(key: string, options: Partial<Track> = {}): void {
        if (this.currentMusic === key) return;

        const track: Track = {
            key,
            loop: false,
            volume: 1.0,
            category: 'music',
            fadeIn: 1000,
            fadeOut: 1000,
            ...options
        };

        // If we're already cross-fading, queue this track
        if (this.isCrossFading) {
            this.queuedMusic = key;
            return;
        }

        // If music is already playing, crossfade
        if (this.currentMusic && this.tracks.has(this.currentMusic)) {
            this.crossFade(this.currentMusic, key, track);
        } else {
            this.startTrack(key, track);
        }
    }

    /**
     * Play a voice track with priority (lowers music volume temporarily)
     */
    playVoice(key: string, options: { volume?: number, ducking?: boolean } = {}): void {

        if (this.muted.master || this.muted.voice) return;

        // Duck background music if requested
        if (options.ducking && this.currentMusic) {
            const musicTrack = this.tracks.get(this.currentMusic);
            if (musicTrack && musicTrack.sound) {
                const originalVolume = musicTrack.sound.volume;
                musicTrack.sound.setVolume(originalVolume * 0.3); // Reduce to 30%
            }
        }

        // Create a track object
        const track: Track = {
            key,
            category: 'voice',
            volume: options.volume || 1.0,
            // No loop for voice tracks
            loop: false
        };

        // Start the track
        this.startTrack(key, track);
    }

    /**
     * Crossfade between two tracks
     */
    private crossFade(fromKey: string, toKey: string, toTrack: Track): void {
        this.isCrossFading = true;
        const fromSound = this.tracks.get(fromKey);

        if (!fromSound) {
            this.startTrack(toKey, toTrack);
            this.isCrossFading = false;
            return;
        }

        // Start fading out current track
        this.scene.tweens.add({
            targets: fromSound,
            volume: 0,
            duration: toTrack.fadeOut,
            onComplete: () => {
                fromSound.stop();
                this.tracks.delete(fromKey);

                // Check if another music change was requested during crossfade
                this.isCrossFading = false;
                if (this.queuedMusic && this.queuedMusic !== toKey) {
                    const nextMusic = this.queuedMusic;
                    this.queuedMusic = null;
                    this.playMusic(nextMusic);
                }
            }
        });

        // Start new track
        this.startTrack(toKey, toTrack);
    }

    /**
     * Start a new track with fade in
     */
    private startTrack(key: string, track: Track): void {
        const actualVolume = (track.volume || 1) * this.volumeLevels.master * this.volumeLevels[track.category];
        const sound = this.scene.sound.add(key, {
            loop: track.loop,
            volume: track.fadeIn ? 0 : actualVolume
        });

        // Store complete Track object with sound
        this.tracks.set(key, {
            ...track,
            sound: sound
        });

        if (track.category === 'music') {
            this.currentMusic = key;
        }

        sound.play();

        // Fade in if needed
        if (track.fadeIn) {
            this.scene.tweens.add({
                targets: sound,
                volume: actualVolume,
                duration: track.fadeIn
            });
        }

        // Auto-cleanup for all non-looping tracks
        if (!track.loop) {
            sound.once('complete', () => {
                // Special handling for voice tracks with ducking
                if (track.category === 'voice' && track.ducking && this.currentMusic) {
                    const musicTrack = this.tracks.get(this.currentMusic);
                    if (musicTrack && musicTrack.sound) {
                        // Restore music volume if it was ducked
                        const restoreVolume = this.volumeLevels.music * this.volumeLevels.master;
                        musicTrack.sound.setVolume(restoreVolume);
                    }
                }

                // Remove the track from our collection
                this.tracks.delete(key);

                // Reset currentMusic if needed
                if (track.category === 'music' && this.currentMusic === key) {
                    this.currentMusic = null;
                }
            });
        }
    }

    /**
     * Stop a specific track with optional fade out
     */
    stopTrack(key: string, fadeOut: number = 0): void {
        const thisTrack = this.tracks.get(key);
        if (!thisTrack) return;

        if (fadeOut > 0) {
            this.scene.tweens.add({
                targets: thisTrack,
                volume: 0,
                duration: fadeOut,
                onComplete: () => {
                    if (thisTrack.sound) {
                        thisTrack.sound.stop();
                    }
                    this.tracks.delete(key);
                    if (this.currentMusic === key) {
                        this.currentMusic = null;
                    }
                }
            });
        } else {
            if (thisTrack.sound) {
                thisTrack.sound.stop();
            }
            this.tracks.delete(key);
            if (this.currentMusic === key) {
                this.currentMusic = null;
            }
        }
    }

    /**
     * Stop all sounds in a specific category
     */
    stopCategory(category: 'music' | 'sfx' | 'voice', fadeOut: number = 0): void {

        this.tracks.forEach((track, key) => {
            if (track.category === category) {
                this.stopTrack(key, fadeOut);
            }
        });

        if (category === 'music') {
            this.currentMusic = null;
        }
    }

    /**
     * Stop all sounds
     */
    stopAll(fadeOut: number = 0): void {
        this.tracks.forEach((track, key) => {
            this.stopTrack(key, fadeOut);
        });
        this.currentMusic = null;
    }

    /**
     * Set volume for a category
     */


    setVolume(category: 'master' | 'music' | 'sfx' | 'voice', level: number): void {

        console.log('setVolume:', { category, level }, this.tracks, this.currentMusic);

        // Clamp the level between 0 and 1
        this.volumeLevels[category] = Math.max(0, Math.min(1, level));

        // Update all playing sounds in this category
        this.tracks.forEach((track, key) => {
            console.log('setVolume:', track);
            if (category === 'master' || category === track.category) {
                track.sound?.setVolume(this.volumeLevels[track.category] * this.volumeLevels.master);
            }
        });

        // Additional setting for YouTube Player (if one is registered) - volume is a percentage
        if (category === 'music' && this.youtubePlayer) {
            this.youtubePlayer.setVolume(this.volumeLevels.music * 100);
        }
    }

    /**
     * Mute/unmute a category
     */
    setMute(category: 'master' | 'music' | 'sfx' | 'voice', muted: boolean): void {
        this.muted[category] = muted;

        // Update all playing sounds
        this.tracks.forEach((track, key) => {
            // Determine if this sound should be muted
            const shouldBeMuted = this.muted.master || this.muted[track.category];
            if (shouldBeMuted) {
                track.sound?.setMute(true);
            } else {
                track.sound?.setMute(false);
            }
        });
    }

    // GETTERS
    getVolume(category: 'master' | 'music' | 'sfx' | 'voice'): number {
        return this.volumeLevels[category];
    }
    isMuted(category: 'master' | 'music' | 'sfx' | 'voice'): boolean {
        return this.muted[category];
    }


    /**
     * Check if a specific track is currently playing
     */
    isPlaying(key: string): boolean {
        const sound = this.tracks.get(key).sound;
        return sound ? sound.isPlaying : false;
    }

    /**
     * Play an ambient loop track (separate from music)
     */
    playAmbient(key: string, options: Partial<Track> = {}): void {
        const track: Track = {
            key,
            loop: true,
            volume: 0.5,
            category: 'sfx',
            fadeIn: 2000,
            fadeOut: 2000,
            ...options
        };

        this.startTrack(key, track);
    }

    /**
     * Register a YouTube player for volume control
     */
    registerYouTubePlayer(player: any): void {
        this.youtubePlayer = player;
    
        // Set initial volume based on current settings
        this.youtubePlayer.setVolume(this.volumeLevels.music * 100);
    }

    unregisterYouTubePlayer(): void {
        this.youtubePlayer = null;
    }


    /**
     * Setup timing-based sound events
     */
    scheduleSoundEvent(callback: () => void, delay: number): void {
        this.scene.time.delayedCall(delay, callback);
    }
}