import { BaseScene } from 'src/BaseScene';
import { SoundManager } from 'src/audio/SoundManager';
import { ThemeManager } from './ThemeManager';

// Types for rexUI plugin used - partial, just what we need here to avoid TS errors
declare namespace rexUI {
    interface Sizer {
        layout(): any;
        add(gameObject: any, config?: any): any;
        setVisible(visible: boolean): any;
    }
}

export class SoundSettingsPanel extends Phaser.GameObjects.Container {
    public scene: BaseScene;
    private soundPanel: rexUI.Sizer;

    constructor(scene: BaseScene) {
        super(scene);
        this.scene = scene;
        this.createSoundPanel();
    }

    private createSoundPanel(): void {

        const theme = ThemeManager.getInstance().getTheme();
        const soundManager = SoundManager.getInstance(this.scene);

        const titleTextConfig = {
            fontFamily: theme.fonts.title,
            fontSize: this.scene.getY(32),
            color: theme.colors.headingText,
            stroke: theme.colors.textStroke,
            strokeThickness: theme.textStrokeThickness
        };

        // Create the main panel using vertical sizer
        this.soundPanel = this.scene.rexUI.add.sizer({
            x: 960,
            y: this.scene.getY(540),
            width: 800,
            orientation: 'vertical',
            space: {
                item: this.scene.getY(28),
                left: 30,
                right: 30,
                top: this.scene.getY(25),
                bottom: this.scene.getY(25)
            }
        });

        this.soundPanel.addBackground(this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, this.scene.getY(theme.panelRoundness), theme.colors.panelBackground).setStrokeStyle(theme.panelStrokeThickness, theme.colors.panelStroke));

        // Add title
        const title = this.scene.rexUI.add.label({
            text: this.scene.add.text(0, 0, 'Sound Settings', titleTextConfig),

        });

        this.soundPanel.add(title);

        //----------------------------------------------
        // Create grid for volume controls
        //
        const grid = this.scene.rexUI.add.gridSizer({
            column: 3,
            row: 4,
            space: { left: 30, right: 30, column: 20, row: this.scene.getY(20) }
        });

        // Set column proportions
        grid.setColumnProportion(0, 1);  // Label column
        grid.setColumnProportion(1, 5);  // Slider column
        grid.setColumnProportion(2, 1);  // Value column

        // Define volume categories
        const categories: { name: string; key: 'music' | 'fx' | 'voice' }[] = [
            { name: 'Music', key: 'music' },
            { name: 'FX', key: 'fx' },
            { name: 'Host', key: 'voice' }
        ];

        // Add volume controls for each category
        const bodyTextConfig = {
            fontFamily: theme.fonts.body,
            fontSize: this.scene.getY(24),
            color: theme.colors.bodyText,
            stroke: theme.colors.textStroke,
            strokeThickness: theme.textStrokeThickness
        };

        categories.forEach((category, index) => {
            // Get current volume
            const currentVolume = soundManager.getVolume(category.key);

            // Add label
            const labelText = this.scene.add.text(0, 0, category.name + ':', bodyTextConfig);
            grid.add(labelText, 0, index, 'right', 0, false);

            // Create slider
            const slider = this.scene.rexUI.add.slider({
                width: 0,
                height: this.scene.getY(20),
                orientation: 'x',
                track: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, this.scene.getY(10), theme.colors.uiBackground),
                indicator: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, this.scene.getY(6), theme.colors.uiControlIndicator),
                thumb: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, this.scene.getY(10), theme.colors.uiControl),
                input: 'click',
                value: currentVolume
            });
            slider.getElement('thumb').setStrokeStyle(2, 0x000000, 1);

            // Create value text
            const valueText = this.scene.add.text(0, 0, Math.round(currentVolume * 100) + '%', bodyTextConfig);

            // Add event for slider value change
            slider.on('valuechange', (value) => {
                // Update AudioManager
                soundManager.setVolume(category.key, value);

                // Update value text
                valueText.setText(Math.round(value * 100) + '%');

                // Play test sound when adjusting certain categories
                if (category.key === 'fx' && !slider.isDragging) {
                    soundManager.stopCategory('fx');
                    soundManager.playFX('answer-correct');
                } else if (category.key === 'voice' && !slider.isDragging) {
                    soundManager.stopCategory('voice'); // Stop any existing voice
                    soundManager.playVoice('quiz-intro-music');
                }
            });

            grid.add(slider, 1, index, 'center', { expand: true }, true);
            grid.add(valueText, 2, index, 'left', 0, false);
        });

        // Add grid to main panel with proportion to push toggles to bottom
        grid.layout();
        this.soundPanel.add(grid, {
            align: 'center',
            proportion: 1, // Allow grid to take available space
            expand: true // Make it expand vertically
        });
        this.soundPanel.addSpace(this.scene.getY(20));

        // -----------------------------------------------
        // Create toggles for muting channels
        //
        const toggleContainer = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: 30 }
        });

        // Add toggle switches for music, fx, and narration
        categories.forEach(category => {
            const isMuted = soundManager.isMuted(category.key);

            // Create toggle label
            const toggleLabel = this.scene.add.text(0, 0, category.name, bodyTextConfig);

            // Create toggle background
            const toggleBg = this.scene.rexUI.add.roundRectangle(
                0, 0, 60, 30, 15,
                isMuted ? theme.colors.buttonBackgroundDisabled : theme.colors.uiControlIndicator
            );

            // Create toggle thumb
            const toggleThumb = this.scene.add.circle(
                isMuted ? -15 : 15, 0,
                12,
                theme.colors.uiControl
            );

            // Create container for background and thumb
            const toggleSwitch = this.scene.add.container(0, 0, [toggleBg, toggleThumb]);
            toggleSwitch.setSize(60, this.scene.getY(30));

            // Make toggle interactive
            toggleBg.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    const categoryMuted = !soundManager.isMuted(category.key);

                    // Update mute state
                    soundManager.setMute(category.key, categoryMuted);

                    // If muting the stop sounds in this category
                    if (categoryMuted) {
                        soundManager.stopCategory(category.key);
                    }

                    // Update toggle appearance
                    toggleBg.setFillStyle(categoryMuted ? theme.colors.buttonBackgroundDisabled : theme.colors.uiControlIndicator);

                    // Animate thumb
                    this.scene.tweens.add({
                        targets: toggleThumb,
                        x: categoryMuted ? -15 : 15,
                        duration: 150,
                        ease: 'Power2'
                    });

                    // Play test sound when toggling
                    if (category.key === 'fx' && !categoryMuted) {
                        soundManager.playFX('answer-correct');
                    } else if (category.key === 'voice' && !categoryMuted) {
                        soundManager.playVoice('sample');
                    }
                });

            // Create a sizer for the toggle and label
            const toggleSizer = this.scene.rexUI.add.sizer({
                orientation: 'vertical',
                space: { item: this.scene.getY(10) }
            });

            toggleSizer.add(toggleLabel, { align: 'center' });
            toggleSizer.add(toggleSwitch, { align: 'center' });

            // Add to toggles container
            toggleContainer.add(toggleSizer);
        });

        // Add toggles container
        toggleContainer.layout();
        this.soundPanel.add(toggleContainer, { align: 'center' });


        // -----------------------------------------------
        // Add "Test Audio" button
        //
        // const testButtonConfig = Object.assign({}, bodyTextConfig, { color: theme.colors.secondaryButtonText });
        // const testButton = this.scene.rexUI.add.label({
        //     background: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, 10, theme.colors.secondaryButtonBackground),
        //     text: this.scene.add.text(0, 0, 'Test Audio', testButtonConfig),
        //     space: { left: 15, right: 15, top: this.scene.getY(8), bottom: this.scene.getY(8) }
        // })
        //     .setInteractive({ useHandCursor: true })
        //     .on('pointerdown', () => {
        //         // Play test sounds for each category
        //         soundManager.playMusic('background', { loop: false });
        //         setTimeout(() => soundManager.playFX('answer-correct'), 500);
        //         setTimeout(() => soundManager.playVoice('sample'), 1000);
        //     })
        //     .on('pointerover', function () {
        //         this.getElement('background').setFillStyle(theme.colors.secondaryButtonBackgroundHover);
        //     })
        //     .on('pointerout', function () {
        //         this.getElement('background').setFillStyle(theme.colors.secondaryButtonBackground);
        //     });

        // this.soundPanel.add(testButton, { align: 'center', padding: { top: this.scene.getY(10) } });

        // -----------------------------------------------
        // Add close button
        //
        const closeButtonConfig = Object.assign({}, titleTextConfig, { color: theme.colors.primaryButtonText });
        console.log('buttonConfig:', closeButtonConfig);
        const closeButton = this.scene.rexUI.add.label({
            background: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, this.scene.getY(theme.buttonRoundness), theme.colors.primaryButtonBackground),
            text: this.scene.add.text(0, 0, 'Close', closeButtonConfig),
            space: { left: 20, right: 20, top: this.scene.getY(12), bottom: this.scene.getY(12) }
        })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggle())
            .on('pointerover', function () {
                this.getElement('background').setFillStyle(theme.colors.primaryButtonBackgroundHover);
            })
            .on('pointerout', function () {
                this.getElement('background').setFillStyle(theme.colors.primaryButtonBackground);
            });

        this.soundPanel.add(closeButton, { align: 'center', padding: { top: this.scene.getY(20) } });


        // Layout and initially hide
        this.soundPanel.layout();
        this.soundPanel.setVisible(false);
    }


    public toggle(): void {
        this.soundPanel.setVisible(!this.soundPanel.visible);
    }

}