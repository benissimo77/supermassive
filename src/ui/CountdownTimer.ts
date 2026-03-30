import { BaseScene } from 'src/BaseScene';

export interface TimerOptions {
    fontSize?: number;
    color?: string;
    onComplete?: () => void;
}

export class CountdownTimer extends Phaser.GameObjects.Container {
    private seconds: number = 0;
    private minText: Phaser.GameObjects.Text;
    private secText: Phaser.GameObjects.Text;
    private event: Phaser.Time.TimerEvent | null = null;

    constructor(scene: BaseScene, x: number, y: number, initialSeconds: number, options: TimerOptions = {}) {
        super(scene, x, y);

        this.seconds = initialSeconds;

        const style = {
            fontFamily: 'Titan One',
            fontSize: `${options.fontSize || 72}px`,
            color: options.color || '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        };

        const mins = Math.floor(this.seconds / 60);
        const secs = this.seconds % 60;

        // Using original "stable positioning" logic from QuizHostScene
        this.minText = scene.add.text(-15, 0, mins.toString().padStart(2, '0'), style).setOrigin(1, 0.5);
        const colon = scene.add.text(0, -6, ":", style).setOrigin(0.5, 0.5);
        this.secText = scene.add.text(15, 0, secs.toString().padStart(2, '0'), style).setOrigin(0, 0.5);

        this.add([this.minText, colon, this.secText]);

        scene.add.existing(this);

        this.start(options.onComplete);
    }

    private start(onComplete?: () => void): void {
        this.stop();
        this.event = this.scene.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.seconds > 0) {
                    this.seconds--;
                    this.updateDisplay();
                    if (this.seconds === 0 && onComplete) {
                        onComplete();
                    }
                }
            },
            loop: true
        });
    }

    public stop(): void {
        if (this.event) {
            this.event.remove();
            this.event = null;
        }
    }

    private updateDisplay(): void {
        const m = Math.floor(this.seconds / 60);
        const s = this.seconds % 60;
        this.minText.setText(m.toString().padStart(2, '0'));
        this.secText.setText(s.toString().padStart(2, '0'));
    }

    public setSeconds(s: number): void {
        this.seconds = s;
        this.updateDisplay();
    }
}
