import { BaseScene } from "src/BaseScene";
import { QuizHostScene } from "./QuizHostScene";
import { SoundSettingsPanel } from "src/ui/SoundSettingsPanel";

export class QuizAdminScene extends BaseScene {
    static readonly KEY = 'QuizAdminScene';

    constructor() {
        super(QuizAdminScene.KEY);
    }

    init(): void {
        super.init();
        this.TYPE = 'admin';

        // Mute all sounds by default in the admin view to avoid double-audio
        // and feedback if the admin is in the same room as the host.
        if (this.soundManager) {
            console.log('QuizAdminScene:: Muting master audio by default');
            this.soundManager.setMute('master', true);
        }
    }

    create(): void {
        super.create();
        
        console.log('QuizAdminScene:: create. Launching QuizHostScene...');

        // Launch the host scene in parallel
        // We pass the same data we received (like quizId)
        this.scene.launch(QuizHostScene.KEY, this.scene.settings.data);
        
        // Wait for the host scene to be ready to manipulate its camera
        this.time.delayedCall(100, () => {
            const hostScene = this.scene.get(QuizHostScene.KEY) as QuizHostScene;
            if (hostScene) {
                // Force the preview to 1080p proportions on startup
                hostScene.handleResize(new Phaser.Structs.Size(1920, 1080));

                console.log('QuizAdminScene:: Windowing QuizHostScene via prerender hook');
                
                // We use the prerender event to force the camera settings every frame.
                // This ensures that even if the HostScene tries to resize itself to full screen,
                // we override it right before it renders, without modifying its source code.
                hostScene.events.on('prerender', () => {
                    const scale = 0.6;
                    const gameScale = this.scale.width / 1920;
                    
                    const worldX = 1920 - (1920 * scale) - 40;
                    const worldY = 40;
                    
                    const x = worldX * gameScale;
                    const y = worldY * gameScale;
                    const width = (1920 * scale) * gameScale;
                    const height = (1080 * scale) * gameScale;
                    
                    const camera = hostScene.cameras.main;
                    if (camera) {
                        camera.setViewport(x, y, width, height);
                        camera.setZoom(scale * gameScale);
                        camera.setScroll(0, 0);
                    }
                });

                this.updateHostPreviewUI();
            }
        });

        // Add some admin UI
        const title = this.add.text(20, 20, 'ADMIN CONTROL PANEL', { 
            fontFamily: '"Titan One", Arial',
            fontSize: '48px', 
            color: '#ffffff' 
        });
        this.UIContainer.add(title);

        const info = this.add.text(20, 80, 'MVP: Host view is windowed in the top right.\nControls will be added here.', { 
            fontSize: '24px', 
            color: '#cccccc' 
        });
        this.UIContainer.add(info);

        // Add a "Next" button as a proof of concept
        const nextBtn = this.add.text(20, 200, '[ NEXT / START QUIZ ]', { 
            fontSize: '32px', 
            color: '#00ff00',
            backgroundColor: '#003300',
            padding: { x: 10, y: 5 }
        }).setInteractive({ useHandCursor: true });

        nextBtn.on('pointerdown', () => {
            console.log('Admin:: Next button clicked. Emitting host:keypress Space');
            // QuizHostScene uses event.code, which for Space is 'Space'
            this.socket.emit('host:keypress', { key: 'Space', shiftKey: false, ctrlKey: false });
        });
        this.UIContainer.add(nextBtn);

        // Add Sound Settings button
        const soundBtn = this.add.text(20, 300, '[ SOUND SETTINGS ]', { 
            fontSize: '32px', 
            color: '#ffff00',
            backgroundColor: '#333300',
            padding: { x: 10, y: 5 }
        }).setInteractive({ useHandCursor: true });

        const soundPanel = new SoundSettingsPanel(this);
        this.UIContainer.add(soundPanel);

        soundBtn.on('pointerdown', () => {
            soundPanel.toggle();
        });
        this.UIContainer.add(soundBtn);
    }

    private previewBorder: Phaser.GameObjects.Graphics;
    private previewLabel: Phaser.GameObjects.Text;

    private updateHostPreviewUI(): void {
        if (!this.UIContainer) return;

        if (this.previewBorder) this.previewBorder.destroy();
        if (this.previewLabel) this.previewLabel.destroy();

        const scale = 0.6;
        const width = 1920 * scale;
        const height = 1080 * scale;
        const x = 1920 - width - 40;
        const y = 40;

        this.previewBorder = this.add.graphics();
        this.previewBorder.lineStyle(4, 0xffffff, 1);
        this.previewBorder.strokeRect(x - 2, y - 2, width + 4, height + 4);
        this.UIContainer.add(this.previewBorder);

        this.previewLabel = this.add.text(x, y + height + 10, 'HOST PREVIEW', { 
            fontSize: '24px', 
            color: '#ffffff',
            backgroundColor: '#000000'
        });
        this.UIContainer.add(this.previewLabel);
    }

    protected sceneShutdown(): void {
        console.log('QuizAdminScene:: sceneShutdown');
    }

    protected sceneDisplay(): void {
        console.log('QuizAdminScene:: sceneDisplay');
        this.updateHostPreviewUI();
    }

    public getPlayerBySessionID(sessionID: string): Phaser.GameObjects.Container {
        console.log('QuizAdminScene:: getPlayerBySessionID:', sessionID);
        return null as any;
    }
}
