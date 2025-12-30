import { BaseScene } from 'src/BaseScene';
import { ThemeManager } from './ThemeManager';

export class UIComponents {
    private scene: BaseScene;
    private themeManager: ThemeManager;
    
    constructor(scene: BaseScene) {
        this.scene = scene;
        this.themeManager = ThemeManager.getInstance();
    }
    
    createVolumeSlider(label: string, initialValue: number, onChange: (value: number) => void): any {
        const theme = this.themeManager.getTheme();
        
        return this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: theme.spacing }
        })
        .add(
            this.scene.add.text(0, 0, label, theme.fonts.body),
            { proportion: 0.3, align: 'left' }
        )
        .add(
            this.scene.rexUI.add.slider({
                width: 200,
                height: 20,
                orientation: 'x',
                track: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, theme.roundness, theme.colors.panel),
                indicator: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, theme.roundness, theme.colors.primary),
                thumb: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, theme.roundness, theme.colors.light),
                input: 'click',
                value: initialValue
            })
            .on('valuechange', onChange),
            { proportion: 0.5 }
        )
        .add(
            this.scene.add.text(0, 0, Math.round(initialValue * 100) + '%', theme.fonts.body),
            { proportion: 0.2, align: 'right' }
        )
        .layout();
    }
    
    createButton(text: string, onClick: () => void): any {
        const theme = this.themeManager.getTheme();
        
        return this.scene.rexUI.add.label({
            background: this.scene.rexUI.add.roundRectangle(0, 0, 0, 0, theme.roundness, theme.colors.primary),
            text: this.scene.add.text(0, 0, text, theme.fonts.body),
            space: {
                left: 10, right: 10, top: 10, bottom: 10
            }
        })
        .setInteractive()
        .on('pointerdown', onClick)
        .on('pointerover', function() {
            this.getElement('background').setFillStyle(theme.colors.info);
        })
        .on('pointerout', function() {
            this.getElement('background').setFillStyle(theme.colors.primary);
        });
    }
    
    // Add more reusable components here
}