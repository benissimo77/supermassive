import { BaseScene } from 'src/BaseScene';

// Assets loaded identically by QuizHostScene and ThreeHostScene's preload() - kept here once
// instead of two copies of the same eight image / three audio / one font entries to keep in sync by hand.
// Each scene still loads its own unique assets itself; this only covers the genuinely shared ones.
export function preloadSharedHostAssets(scene: BaseScene): void {
    scene.load.image('quiz-background', '/img/quiz/background.jpg');
    scene.load.image('simple-button', '/assets/img/simplebutton.png');
    scene.load.image('simple-button-hover', '/assets/img/simplebutton-hover.png');
    scene.load.image('dropzone', '/assets/img/dropzone.png');
    scene.load.image('dropzone-square', '/assets/img/dropzone-square.png');
    scene.load.image('checkmark', '/assets/three/checkmark.png');
    scene.load.image('crossmark', '/assets/three/crossmark.png');
    scene.load.image('playernamepanel', '/assets/rounded-rect-grey-480x48x14.png');

    scene.load.audio('quiz-countdown', '/assets/audio/quiz/music/quiz-countdown-337785.mp3');
    scene.load.audio('question-answered', '/assets/audio/quiz/fx/446100__justinvoke__bounce.wav');
    scene.load.audio('end-question', '/assets/audio/quiz/fx/gong-hit-2-184010.mp3');

    scene.load.rexWebFont({
        google: {
            families: ['Titan One']
        }
    });
}
