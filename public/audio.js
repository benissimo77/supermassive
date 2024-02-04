class AudioManager {
    constructor() {

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
        // If there's a track of the same type playing, fade it out
        if (this.currentlyPlaying[track.type]) {
            this.fadeOut(track.type);
        }
        // Play the new track and set it as the currently playing track
        track.audio.volume = 0;
        track.play();
        gsap.to(track.audio, { volume: track.volume, duration: this.duration });
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

// Experiments with Audio object
const audioManager = new AudioManager();

class AudioTrack {
    constructor(name, type, path, volume = 0.5) {
        this.name = name;
        this.type = type;
        this.path = path;
        this.audio = new Audio(path);
        this.volume = this.audio.volume = volume;   // store a cache of volume so we can fade out and back in
    }

    play() {
        this.audio.play();
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }
}

const AudioTypes = {
    MUSIC: 'MUSIC',
    EFFECT: 'EFFECT',
    NARRATOR: 'NARRATOR'
}

const musicTracks = {
    NIGHT: new AudioTrack('NIGHT', AudioTypes.MUSIC, '/audio/spookynight-1.mp3'),
    MORNING: new AudioTrack('DAY', AudioTypes.MUSIC, '/audio/happyday-1.mp3'),
}
const effectTracks = {
    WOLFHOWL: new AudioTrack('WOLFHOWL', AudioTypes['EFFECT'], '/audio/wolfhowl-1.mp3'),
    WOLFATTACK: new AudioTrack('WOLFATTACK', AudioTypes['EFFECT'], '/audio/wolfattack-1.mp3'),
    VILLAGER: new AudioTrack('VILLAGER', AudioTypes['EFFECT'], '/audio/villager-1.mp3'),
} 
// const narratorTracks = {
//     NIGHT: new AudioTrack('NIGHT', AudioTypes['NARRATOR'], '/audio/narrator-night-1.mp3'),
//     DAY: new AudioTrack('DAY', AudioTypes['NARRATOR'], '/audio/narrator-day-1.mp3'),
// }