// AudioManager requires the gsap library to handle audio fade in/out effects
import { gsap } from 'gsap';

export class AudioManager {
    constructor() {
        console.log('AudioManager.constructor');
        
        // global duration parameter to control fade in/out duration
        this.duration = 2;
        this.currentlyPlaying = {
            MUSIC: null,
            EFFECT: null,
            NARRATOR: null
        };
    }
    
    stopAllAudio() {
        for (const type in this.currentlyPlaying) {
            if (this.currentlyPlaying[type]) {
                this.fadeOut(type);
            }
        }
    }
    playTrack(track) {
        console.log('AudioManager.playTrack:', track.name, track.type);

        // If there's a track of the same type playing, fade it out
        if (this.currentlyPlaying[track.type]) {
            this.fadeOut(track.type);
        }
        // Play the new track and set it as the currently playing track
        track.audio.volume = 0;
        track.currentTime = 0;
        if (track.type == AudioTypes.MUSIC) {
            gsap.set(track.audio, { volume:0 });
            gsap.to(track.audio, { volume: track.volume, duration: this.duration });
        } else {
            gsap.set(track.audio, { volume: track.volume });
        }
        track.play();
        this.currentlyPlaying[track.type] = track;
    }
    fadeOut(type) {
        console.log('fadeOut:', type)
        if (this.currentlyPlaying[type]) {
            const track = this.currentlyPlaying[type];
            const volume = track.audio.volume;
            gsap.to(track.audio, { volume: 0, duration: this.duration, onComplete: () => track.stop() });
        }
    }
}

export class AudioTrack {
    constructor(name, type, path, volume = 0.5) {
        this.name = name;
        this.type = type;
        this.path = path;
        this.audio = new Audio();
        this.volume = this.audio.volume = volume;   // store a cache of volume so we can fade out and back in

        // From https://stackoverflow.com/questions/11652197/play-multiple-sound-at-the-same-time
        var src = document.createElement("source");
        src.type = "audio/mp3";
        src.src = path;
        this.audio.appendChild(src);
    }

    play() {
        console.log('AudioTrack.play:', this.name, this.path);
        this.audio.play();
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }

}

export const AudioTypes = {
    MUSIC: 'MUSIC',
    EFFECT: 'EFFECT',
    NARRATOR: 'NARRATOR'
}
