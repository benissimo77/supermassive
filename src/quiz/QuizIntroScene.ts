import gsap from 'gsap';

interface IntroData {
    title: string;
    description: string;
    samples: { text: string }[];
}

/**
 * QuizIntroScene — secondary overlay scene for the quiz opening credits animation.
 *
 * Intentionally extends Phaser.Scene (NOT BaseScene) to avoid registering
 * duplicate socket listeners on the shared socket singleton. BaseScene.init()
 * registers playerconnect / playerdisconnect / server:players / server:ping
 * handlers — running those twice (once in QuizHostScene, once here) would
 * cause every socket event to be handled twice for the entire session.
 *
 * The only BaseScene features needed here are getY() and a container, both
 * trivial to replicate directly.
 *
 * Lifecycle rules:
 *  - Launched by QuizHostScene via scene.launch() — never scene.start().
 *  - Ends with scene.sleep() so shutdown() is never called and no listeners are torn down.
 *  - Signals completion by emitting 'intro:complete' on QuizHostScene's event emitter.
 */
export class QuizIntroScene extends Phaser.Scene {

    static readonly KEY = 'QuizIntroScene';

    private mainContainer: Phaser.GameObjects.Container;
    private introTimeline: gsap.core.Timeline | null = null;

    constructor() {
        super(QuizIntroScene.KEY);
    }

    create(): void {
        this.mainContainer = this.add.container(0, 0);

        // When woken from sleep, receive fresh data and replay the animation.
        this.events.on('wake', (_sys: any, data: IntroData) => {
            this.playIntro(data);
        });

        // Play immediately on first launch.
        const data = this.scene.settings.data as IntroData;
        if (data) {
            this.playIntro(data);
        }
    }

    // Mirrors BaseScene.getY() — scales a logical 1080p y-value to the actual screen height.
    private getY(logicalY: number): number {
        return logicalY * (this.scale.height / 1080);
    }

    private playIntro(data: IntroData): void {
        const { title = '', description = '', samples = [] } = data || {};

        if (this.introTimeline) {
            this.introTimeline.kill();
        }
        this.mainContainer.removeAll(true);

        this.introTimeline = gsap.timeline();
        const tl = this.introTimeline;

        // Question "Flybys" — fast horizontal sweeps behind the title.
        samples.forEach((sample, index) => {
            const flyText = this.add.text(-200, this.getY(150 + (index * 70)), (sample.text || '').toUpperCase(), {
                fontFamily: 'Titan One',
                fontSize: this.getY(32),
                color: '#ffffff'
            }).setOrigin(0, 0.5).setAlpha(0.1);
            this.mainContainer.add(flyText);
            tl.to(flyText, { x: 2000, duration: 4 + Math.random() * 4, ease: 'none' }, index * 0.5);
        });

        // Dramatic title blast.
        const creditsTitle = this.add.text(960, this.getY(500), title.toUpperCase(), {
            fontFamily: 'Titan One',
            fontSize: this.getY(160),
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 20,
            align: 'center',
            wordWrap: { width: 1600 }
        }).setOrigin(0.5).setAlpha(0).setScale(0.1);
        this.mainContainer.add(creditsTitle);

        tl.to(creditsTitle, { duration: 1.2, alpha: 1, scale: 1, ease: 'back.out(1.5)' }, 1.0);

        // Presenter / description reveal.
        const cleanDescription = description.replace(/<\/?[^>]+(>|$)/g, '');
        const descText = this.add.text(960, this.getY(750), cleanDescription.toUpperCase(), {
            fontFamily: 'Titan One',
            fontSize: this.getY(48),
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
            wordWrap: { width: 1400 }
        }).setOrigin(0.5).setAlpha(0);
        this.mainContainer.add(descText);

        tl.to(descText, { alpha: 1, y: this.getY(700), duration: 1.5, ease: 'power4.out' }, 3.0);

        // "GET READY!" blast.
        const readyText = this.add.text(960, this.getY(850), 'GET READY!', {
            fontFamily: 'Titan One',
            fontSize: this.getY(100),
            color: '#00ccff',
            stroke: '#ffffff',
            strokeThickness: 10
        }).setOrigin(0.5).setAlpha(0).setScale(2);
        this.mainContainer.add(readyText);

        tl.to(readyText, { alpha: 1, scale: 1, duration: 1, ease: 'expo.out' }, 12.0);

        // Hold for a beat then signal completion.
        tl.add(() => this.onIntroComplete(), '+=1');
    }

    private onIntroComplete(): void {
        console.log('QuizIntroScene:: intro complete — signalling QuizHostScene');

        const hostScene = this.scene.get('QuizHostScene');
        if (hostScene) {
            hostScene.events.emit('intro:complete');
        }

        // Sleep rather than stop — preserves all objects so the scene can be woken for replay.
        this.scene.sleep();
    }
}
