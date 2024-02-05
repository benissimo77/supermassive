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

// Experiments with Audio object
const audioManager = new AudioManager();

class AudioTrack {
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
    NIGHT: new AudioTrack('NIGHT', AudioTypes.MUSIC, '/audio/spookynight-1.mp3', 0.3),
    MORNING: new AudioTrack('DAY', AudioTypes.MUSIC, '/audio/happyday-1.mp3'),
}
const effectTracks = {
    WOLFHOWL: new AudioTrack('WOLFHOWL', AudioTypes['EFFECT'], '/audio/wolfhowl-1.mp3'),
    WOLFATTACK: new AudioTrack('WOLFATTACK', AudioTypes['EFFECT'], '/audio/wolfattack-1.mp3')
} 
const narratorTracks = {
    WAKEUP: new AudioTrack('WAKEUP', AudioTypes['NARRATOR'], '/audio/narrator-wakeup-1.mp3'),
    WOLFOPEN: new AudioTrack('WOLFOPEN', AudioTypes['NARRATOR'], '/audio/narrator-wolf-openeyes-1.mp3'),
    WOLFCLOSE: new AudioTrack('WOLFCLOSE', AudioTypes['NARRATOR'], '/audio/narrator-wolf-closeeyes-1.mp3'),
    WITCHOPEN: new AudioTrack('WITCHOPEN', AudioTypes['NARRATOR'], '/audio/narrator-witch-openeyes-1.mp3'),
    WITCHSAVE: new AudioTrack('WITCHSAVE', AudioTypes['NARRATOR'], '/audio/narrator-witch-save-1.mp3'),
    WITCHCLOSE: new AudioTrack('WITCHCLOSE', AudioTypes['NARRATOR'], '/audio/narrator-witch-closeeyes-1.mp3'),
    HEALEROPEN: new AudioTrack('HEALEROPEN', AudioTypes['NARRATOR'], '/audio/narrator-healer-openeyes-1.mp3'),
    HEALERCLOSE: new AudioTrack('HEALERCLOSE', AudioTypes['NARRATOR'], '/audio/narrator-healer-closeeyes-1.mp3'),
    SEEROPEN: new AudioTrack('SEERHOPEN', AudioTypes['NARRATOR'], '/audio/narrator-seer-openeyes-1.mp3'),
    SEERCLOSE: new AudioTrack('SEERCLOSE', AudioTypes['NARRATOR'], '/audio/narrator-seer-closeeyes-1.mp3'),
}