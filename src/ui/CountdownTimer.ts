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
    private timerGraphics: Phaser.GameObjects.Graphics;

    private event: Phaser.Time.TimerEvent | null = null;
    private sweepEvent: Phaser.Time.TimerEvent | null = null;

    constructor(scene: BaseScene, x: number, y: number, initialSeconds: number, options: TimerOptions = {}) {
        super(scene, x, y);

        console.log('CountdownTimer initialized with seconds:', initialSeconds);

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

        // Add the timer graphics to the container
        this.timerGraphics = scene.add.graphics();
        // When adding filters to a graphic the display coordinate system gets confused
        // Simplest is to not use a filter when placing graphics inside of containers and moving/scaling them...
        // this.timerGraphics.enableFilters();
        // this.timerGraphics.filters.internal.addGlow(0x00ccff, 4);

        this.add([this.minText, colon, this.secText, this.timerGraphics]);

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
        this.sweepEvent = this.scene.time.addEvent({
            delay: 16, // roughly 60 FPS
            callback: () => {
                this.drawTimerGraphics();
            },
            loop: true
        });
    }

    public stop(): void {
        if (this.event) {
            this.event.remove();
            this.event = null;
        }
        if (this.sweepEvent) {
            this.sweepEvent.remove();
            this.sweepEvent = null;
        }
    }

    private drawTimerGraphics(): void {
        if (!this.timerGraphics) return;

        const graphics = this.timerGraphics;
        graphics.clear();

        const totalSeconds = this.seconds;
        const subSecond = (this.scene.time.now % 1000) / 1000;
        
        // Ticks represent seconds remaining in the current minute (0-59)
        const secsInMinute = totalSeconds % 60;
        
        const centerX = 0;
        const centerY = 0;
        const radius = 150;
        
        // 1. Outer Ring: 60 Ticks
        for (let i = 0; i < 60; i++) {
            const angle = Phaser.Math.DegToRad((i * 6) - 90);
            
            // Ticks "disappear" as seconds count down
            // If i < secsInMinute, it's a remaining second
            const isActive = i < secsInMinute;
            
            const r1 = radius + 25;
            const r2 = radius + 50;
            
            if (isActive) {
                graphics.lineStyle(6, 0x00ccff, 1);
            } else {
                graphics.lineStyle(2, 0xffffff, 0.1);
            }
            
            graphics.lineBetween(
                centerX + Math.cos(angle) * r1,
                centerY + Math.sin(angle) * r1,
                centerX + Math.cos(angle) * r2,
                centerY + Math.sin(angle) * r2
            );
        }

        // 2. Inner Ring: Sweep logic (30s fill, 30s erase for active feel)
        // We use actual time for smooth sub-second sweeping
        const sweepProgress = (this.scene.time.now / 1000) % 2; // 0.0 to 2.0
        
        if (sweepProgress < 1) {
            // Phase 1: Fill
            graphics.lineStyle(12, 0x00ccff, 1);
            graphics.beginPath();
            graphics.arc(centerX, centerY, radius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + (sweepProgress * 360)), false);
            graphics.strokePath();
        } else {
            // Phase 2: Erase
            const eraseProgress = sweepProgress - 1;
            // Draw full ring base
            graphics.lineStyle(12, 0x00ccff, 1);
            graphics.beginPath();
            graphics.arc(centerX, centerY, radius, Phaser.Math.DegToRad(-90 + eraseProgress * 360), Phaser.Math.DegToRad(270), false);
            graphics.strokePath();            
        }
    }

    // updateDisplay called each second to refresh timer text and the circular timer second markers
    private updateDisplay(): void {
        const m = Math.floor(this.seconds / 60);
        const s = this.seconds % 60;
        this.minText.setText(m.toString().padStart(2, '0'));
        this.secText.setText(s.toString().padStart(2, '0'));
    }

    public setSeconds(s: number): void {
        this.seconds = s;
        this.updateDisplay();

        // Visual feedback for the adjustment
        this.scene.tweens.add({
                targets: [this.minText, this.secText],
                scale: 1.2,
                duration: 100,
                yoyo: true,
                ease: 'Quad.easeOut'
            });
    }

    public destroy(): void {
        this.minText.destroy();
        this.secText.destroy();
        this.timerGraphics.destroy();

        // Kill all time events
        if (this.event) {
            this.event.destroy();
            this.event = null;
        }
        if (this.sweepEvent) {
            this.sweepEvent.destroy();
            this.sweepEvent = null;
        }

        this.timerGraphics.destroy();
        super.destroy();
    }
}
