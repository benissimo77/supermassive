import { AudioTrack, AudioTypes } from '../audiomanager.js'

export const musicTracks = {
    NIGHT: new AudioTrack('NIGHT', AudioTypes.MUSIC, './audio/werewolves/spookynight-1.mp3'),
    MORNING: new AudioTrack('DAY', AudioTypes.MUSIC, './audio/werewolves/happyday-1.mp3'),
}

export const effectTracks = {
    // WOLFHOWL: new AudioTrack('WOLFHOWL', AudioTypes['EFFECT'], './audio/werewolves/wolfhowl-1.mp3'),
    // WOLFATTACK: new AudioTrack('WOLFATTACK', AudioTypes['EFFECT'], './audio/werewolves/wolfattack-1.mp3')
}

export const narratorTracks = {
    WAKEUP: new AudioTrack('WAKEUP', AudioTypes['NARRATOR'], './audio/werewolves/narrator-wakeup-1.mp3'),
    WOLFOPEN: new AudioTrack('WOLFOPEN', AudioTypes['NARRATOR'], './audio/werewolves/narrator-wolf-openeyes-1.mp3'),
    WOLFCLOSE: new AudioTrack('WOLFCLOSE', AudioTypes['NARRATOR'], './audio/werewolves/narrator-wolf-closeeyes-1.mp3'),
    WITCHOPEN: new AudioTrack('WITCHOPEN', AudioTypes['NARRATOR'], './audio/werewolves/narrator-witch-openeyes-1.mp3'),
    WITCHSAVE: new AudioTrack('WITCHSAVE', AudioTypes['NARRATOR'], './audio/werewolves/narrator-witch-save-1.mp3'),
    WITCHCLOSE: new AudioTrack('WITCHCLOSE', AudioTypes['NARRATOR'], './audio/werewolves/narrator-witch-closeeyes-1.mp3'),
    HEALEROPEN: new AudioTrack('HEALEROPEN', AudioTypes['NARRATOR'], './audio/werewolves/narrator-healer-openeyes-1.mp3'),
    HEALERCLOSE: new AudioTrack('HEALERCLOSE', AudioTypes['NARRATOR'], './audio/werewolves/narrator-healer-closeeyes-1.mp3'),
    SEEROPEN: new AudioTrack('SEEROPEN', AudioTypes['NARRATOR'], './audio/werewolves/narrator-seer-openeyes-1.mp3'),
    SEERCLOSE: new AudioTrack('SEERCLOSE', AudioTypes['NARRATOR'], './audio/werewolves/narrator-seer-closeeyes-1.mp3'),
}

