import { BaseScene } from "src/BaseScene";

export class LobbyHUD extends Phaser.GameObjects.Container {

    declare public scene: BaseScene;

    // The different elements that make up the lobby HUD - we keep references to them here for easy cleanup later
    private titleText: Phaser.GameObjects.Text
    private startingSoonText: Phaser.GameObjects.Text
    private playerCountText: Phaser.GameObjects.Text
    private HUDTimerGraphics: Phaser.GameObjects.Graphics;
    private HUDCountdownSeconds: number = 600; // Default to 60 seconds, can be updated by host
    private instructionsPanel: Phaser.GameObjects.Container;
    private roomID: string = "";

    constructor(scene: BaseScene, x: number, y: number, title: string = "Waiting for players...") {
        super(scene, x, y);

        this.scene = scene;

        // Title Text
        this.titleText = this.scene.add.text(960, 60, title.toUpperCase(), {
            fontFamily: 'Titan One',
            fontSize: '110px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 12
        }).setOrigin(0.5);

        this.startingSoonText = this.scene.add.text(1400, 320, "STARTING SOON!", {
            fontFamily: 'Titan One',
            fontSize: '48px',
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0, 0.5);

        this.playerCountText = this.scene.add.text(1400, 380, `WAITING FOR PLAYERS`, {
            fontFamily: 'Titan One',
            fontSize: '36px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0, 0.5);


        // HUD Timer Graphics
        // Add Bloom effect to make the neon blue elements glow
        // (color, offsetX, offsetY, blurStrength, strength)
        this.HUDTimerGraphics = this.scene.add.graphics();
        this.HUDTimerGraphics.postFX.addBloom(0x00ccff, 1, 1, 2, 1.5);

        // Countdown Clock
        // We use fixed offsets from center to ensure stable positioning regardless of character width
        const timerStyle = {
            fontFamily: 'Titan One',
            fontSize: '72px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        };
        const countdownContainer: Phaser.GameObjects.Container = this.scene.add.container(960, 350);
        const minText = this.scene.add.text(-15, 0, "", timerStyle).setOrigin(1, 0.5);
        const colon = this.scene.add.text(0, -6, ":", timerStyle).setOrigin(0.5, 0.5);
        const secText = this.scene.add.text(15, 0, "", timerStyle).setOrigin(0, 0.5);

        countdownContainer.add([minText, colon, secText, this.HUDTimerGraphics]);
        countdownContainer.setPosition(960, 350);
        
        // Start countdown only once
        if (!this.scene.data.get('timerStarted')) {
            this.scene.data.set('timerStarted', true);
            this.scene.time.addEvent({
                delay: 1000,
                callback: () => {
                    if (this.HUDCountdownSeconds > 0) {
                        this.HUDCountdownSeconds--;
                        if (minText.active) {
                            const m = Math.floor(this.HUDCountdownSeconds / 60);
                            const s = this.HUDCountdownSeconds % 60;
                            minText.setText(`${m.toString().padStart(2, '0')}`);
                            secText.setText(`${s.toString().padStart(2, '0')}`);
                        }
                    }
                },
                loop: true
            });
        }

        this.add([this.titleText, this.startingSoonText, this.playerCountText, countdownContainer]);

    }

    // showInstructionPanel - this creates the instruction panel with the QR code and text instructions on how to join
    // Separated out as we must wait until we have a roomID before we can build the panel
    public showInstructionPanel(roomID: string, instructionState: 'hidden' | 'minimized' | 'maximized' = 'maximized'): void {

        this.roomID = roomID;

        if (this.instructionsPanel) {
            this.instructionsPanel.destroy();
        }

        // Load QR code image if not already loaded
        if (this.scene.textures.exists('roomQR')) {
            console.log('LobbyHUD:: roomQR texture already exists, skipping load');
        } else {
            // Load the QR code for this specific room
            this.scene.load.image('roomQR', `/assets/qr/${this.roomID}.png`);
            this.scene.load.once('complete', (data:any) => {
                console.log('ThreeHostScene:: QR Loaded', {data} );
                this.showInstructionPanel(this.roomID, instructionState);
            });
            this.scene.load.start();
        }
        
        
        if (instructionState === 'hidden') return;

        if (instructionState === 'maximized') {
            const panelWidth = 1600;
            const panelHeight = 352; // Height is determined by QR(320) + 16px border top/bottom
            const qrBlockSize = 352; // Width is determined by QR(320) + 16px border left/right
            const textPanelWidth = panelWidth - qrBlockSize; 

            // Position lower (bottom-heavy layout)
            this.instructionsPanel = this.scene.add.container(960, this.scene.getY(1080) - 380);
            
            // Background for Text (Semi-transparent black)
            const bgText = this.scene.add.rectangle(-(panelWidth / 2), 0, textPanelWidth, panelHeight, 0x000000, 0.6)
                .setOrigin(0, 0).setInteractive();
            
            // Background for QR (Solid White as requested for a perfect fit)
            const bgQR = this.scene.add.rectangle((panelWidth / 2) - qrBlockSize, 0, qrBlockSize, panelHeight, 0x000000, 0.6)
                .setOrigin(0, 0).setInteractive();
            
            this.instructionsPanel.add([bgText, bgQR]);

            // Left side: Join Text (Tweaked vertical offsets to center in 352 height)
            const leftX = -(panelWidth / 2) + 60;
            const joinText = this.scene.add.text(leftX, 85, 'JOIN AT:', { 
                fontFamily: 'Titan One', 
                fontSize: '48px', 
                color: '#fff' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(joinText);

            const urlText = this.scene.add.text(leftX, 185, 'VIDEOSWIPE.NET', { 
                fontFamily: 'Titan One', 
                fontSize: '80px', 
                color: '#fff'
            }).setOrigin(0, 1);
            this.instructionsPanel.add(urlText);

            const roomText = this.scene.add.text(leftX, 285, 'ROOM: ' + this.roomID, { 
                fontFamily: 'Titan One', 
                fontSize: '80px', 
                color: '#FFFF00' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(roomText);

            const orText = this.scene.add.text(textPanelWidth - 1100, 200, 'OR', { 
                fontFamily: 'Titan One', 
                fontSize: '72px', 
                color: '#66d' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(orText);

            // Right side: QR Code (Perfectly centered in the white 352x352 block)
            if (this.scene.textures.exists('roomQR')) {
                const qrImageSize = 320;
                const qr = this.scene.add.image((panelWidth / 2) - (qrBlockSize / 2), panelHeight / 2, 'roomQR')
                    .setDisplaySize(qrImageSize, qrImageSize);
                this.instructionsPanel.add(qr);
                console.log('LobbyHUD:: Added roomQR to instructions panel with 16px border');

            }

        } else if (instructionState === 'minimized') {
            // Watermark state: Bottom-left corner
            this.instructionsPanel = this.scene.add.container(40, this.scene.getY(1080) - 40);
            
            const bg = this.scene.add.rectangle(0, 0, 400, 140, 0x000000, 0.6).setOrigin(0, 1).setInteractive();
            this.instructionsPanel.add(bg);

            if (this.scene.textures.exists('roomQR')) {
                const qrImage = this.scene.add.image(10, -10, 'roomQR').setDisplaySize(120, 120).setOrigin(0, 1);
                this.instructionsPanel.add(qrImage);
            }

            const joinText = this.scene.add.text(140, -105, 'JOIN AT:', { 
                fontFamily: 'Titan One', 
                fontSize: '20px', 
                color: '#77e' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(joinText);

            const urlText = this.scene.add.text(140, -70, 'VIDEOSWIPE.NET', { 
                fontFamily: 'Titan One', 
                fontSize: '24px', 
                color: '#fff' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(urlText);

            const roomText = this.scene.add.text(140, -15, 'ROOM: ' + this.roomID, { 
                fontFamily: 'Titan One', 
                fontSize: '32px', 
                color: '#FFFF00' 
            }).setOrigin(0, 1);
            this.instructionsPanel.add(roomText);
        }

        this.add(this.instructionsPanel);
    }

    public toggleInstructionPanel(newState: 'hidden' | 'minimized' | 'maximized'): void {

        this.showInstructionPanel(this.roomID, newState);
    }

    public updatePlayerCount(count: number): void {
        this.playerCountText.setText(`${count} PLAYERS JOINED`);
    }

    public updateHUDTimerGraphics(): void {

        if (!this.HUDTimerGraphics) return;

        const graphics = this.HUDTimerGraphics;
        graphics.clear();

        const totalSeconds = this.HUDCountdownSeconds;
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
        const sweepProgress = ((this.scene.time.now / 1000) % 2); // 0.0 to 2.0
        
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


}