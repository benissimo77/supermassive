import { BaseScene } from "src/BaseScene";
import { QuizHostScene } from "./QuizHostScene";
import { PlayerConfig } from "src/play/DOMPlayer";

export class QuizAdminScene extends BaseScene {
    static readonly KEY = 'QuizAdminScene';

    // Design Constants for "Television Control Panel" aesthetic
    private readonly COLORS = {
        bg: '#121212',
        panel: '#1e1e1e',
        border: '#333333',
        text: '#ffffff',
        textDim: '#aaaaaa',
        accent: '#007bff', // Professional Blue
        success: '#28a745', // Professional Green
        danger: '#dc3545',  // Professional Red
        inactive: '#444444'
    };

    private readonly FONTS = {
        main: 'Arial, Helvetica, sans-serif',
        mono: 'Consolas, Monaco, "Courier New", monospace'
    };

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
        
        // Set background color
        this.cameras.main.setBackgroundColor(this.COLORS.bg);

        console.log('QuizAdminScene:: create. Launching QuizHostScene...');

        // Launch the host scene in parallel
        this.scene.launch(QuizHostScene.KEY, this.scene.settings.data);
        
        // Wait for the host scene to be ready to manipulate its camera
        this.time.delayedCall(100, () => {
            const hostScene = this.scene.get(QuizHostScene.KEY) as QuizHostScene;
            if (hostScene) {
                // Override handleResize to always stay at 1080p logical height
                // This prevents the preview from reacting to the admin window's actual height
                hostScene.handleResize = () => {
                    hostScene.updateHeight(1080);
                    const camera = hostScene.cameras.main;
                    if (camera) {
                        camera.setOrigin(0, 0);
                        camera.setScroll(0, 0);
                    }
                    // Ensure child scene updates its layout
                    (hostScene as any).render();
                };

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

        // --- HEADER ---
        const title = this.add.text(40, 40, 'SUPERMASSIVE // ADMIN CONTROL', { 
            fontFamily: this.FONTS.mono,
            fontSize: '24px', 
            fontStyle: 'bold',
            color: this.COLORS.accent,
            letterSpacing: 2
        });
        this.UIContainer.add(title);

        const divider = this.add.graphics();
        divider.lineStyle(2, 0x333333);
        divider.lineBetween(40, 80, 600, 80);
        this.UIContainer.add(divider);

        // --- SECTION: GAME CONTROLS ---
        const gameHeader = this.add.text(40, 120, 'GAME EXECUTION', {
            fontFamily: this.FONTS.mono,
            fontSize: '14px',
            color: this.COLORS.textDim
        });
        this.UIContainer.add(gameHeader);

        const nextBtn = this.add.text(40, 150, 'ADVANCE STATE [SPACE]', { 
            fontFamily: this.FONTS.main,
            fontSize: '20px', 
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: this.COLORS.success,
            padding: { x: 20, y: 12 }
        }).setInteractive({ useHandCursor: true });

        nextBtn.on('pointerdown', () => {
            this.socket.emit('host:keypress', { key: 'ArrowRight', shiftKey: false, ctrlKey: false });
        });
        this.UIContainer.add(nextBtn);

        // --- SECTION: STREAM CONTROLS ---
        const streamHeader = this.add.text(40, 250, 'BROADCAST SETTINGS', {
            fontFamily: this.FONTS.mono,
            fontSize: '14px',
            color: this.COLORS.textDim
        });
        this.UIContainer.add(streamHeader);

        this.streamModeBtn = this.add.text(40, 280, 'STREAM MODE: OFF', { 
            fontFamily: this.FONTS.main,
            fontSize: '20px', 
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: this.COLORS.inactive,
            padding: { x: 20, y: 12 }
        }).setInteractive({ useHandCursor: true });

        this.streamModeBtn.on('pointerdown', () => {
            this.socket.emit('host:keypress', { key: 'KeyS', shiftKey: false, ctrlKey: false });
        });
        this.UIContainer.add(this.streamModeBtn);

        // --- SECTION: GHOST PLAYERS ---
        const ghostHeader = this.add.text(40, 380, 'GHOST PLAYERS (BOTS)', {
            fontFamily: this.FONTS.mono,
            fontSize: '14px',
            color: this.COLORS.textDim
        });
        this.UIContainer.add(ghostHeader);

        const spawnGhostBtn = this.add.text(40, 410, 'SPAWN GHOST', { 
            fontFamily: this.FONTS.main,
            fontSize: '18px', 
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#6c757d',
            padding: { x: 15, y: 10 }
        }).setInteractive({ useHandCursor: true });

        spawnGhostBtn.on('pointerdown', () => {
            this.socket.emit('host:spawn_ghost');
            this.logEvent('SPAWNING GHOST BOT...', 'system');
        });
        this.UIContainer.add(spawnGhostBtn);

        const clearGhostsBtn = this.add.text(220, 410, 'CLEAR ALL GHOSTS', { 
            fontFamily: this.FONTS.main,
            fontSize: '18px', 
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#343a40',
            padding: { x: 15, y: 10 }
        }).setInteractive({ useHandCursor: true });

        clearGhostsBtn.on('pointerdown', () => {
            this.socket.emit('host:remove_ghosts');
            this.logEvent('REMOVING ALL GHOST BOTS', 'system');
        });
        this.UIContainer.add(clearGhostsBtn);

        // --- SECTION: LIVE ROSTER ---
        this.createRoster();

        // --- SECTION: EVENT FEED ---
        this.createEventFeed();
        this.setupGameEventListeners();

        // --- FOOTER / STATUS ---
        const status = this.add.text(40, 1040, 'SYSTEM STATUS: NOMINAL // CONNECTION: SECURE', {
            fontFamily: this.FONTS.mono,
            fontSize: '12px',
            color: this.COLORS.success
        });
        this.UIContainer.add(status);

        // Listen for stream mode updates from server
        this.socket.on('server:streammode', (data: { enabled: boolean }) => {
            this.isStreamMode = data.enabled;
            this.updateStreamModeUI();
            this.logEvent(`STREAM MODE: ${data.enabled ? 'ON' : 'OFF'}`, 'system');
        });
    }

    public handleResize(gameSize: Phaser.Structs.Size): void {
        super.handleResize(gameSize);
        this.updateHostPreviewUI();
    }

    private updateStreamModeUI(): void {
        if (!this.streamModeBtn) return;

        if (this.isStreamMode) {
            this.streamModeBtn.setText('STREAM MODE: ON');
            this.streamModeBtn.setBackgroundColor(this.COLORS.danger); // Red for "On Air" feel
        } else {
            this.streamModeBtn.setText('STREAM MODE: OFF');
            this.streamModeBtn.setBackgroundColor(this.COLORS.inactive);
        }

        // Refresh the preview UI to show/hide the LIVE indicator
        this.updateHostPreviewUI();
    }

    private previewBorder: Phaser.GameObjects.Graphics;
    private previewLabel: Phaser.GameObjects.Text;
    private liveIndicator: Phaser.GameObjects.Text;
    private streamModeBtn: Phaser.GameObjects.Text;
    private rosterElement: Phaser.GameObjects.DOMElement;
    private eventFeedElement: Phaser.GameObjects.DOMElement;
    private isStreamMode: boolean = false;
    private eventLog: string[] = [];

    private createRoster(): void {
        const rosterX = 40;
        const rosterY = 500;
        const rosterWidth = 300;
        const rosterHeight = 480;

        const rosterHeader = this.add.text(rosterX, rosterY, 'LIVE ROSTER', {
            fontFamily: this.FONTS.mono,
            fontSize: '14px',
            color: this.COLORS.textDim
        });
        this.UIContainer.add(rosterHeader);

        // Create a container div for the roster
        const rosterDiv = document.createElement('div');
        rosterDiv.style.width = `${rosterWidth}px`;
        rosterDiv.style.height = `${rosterHeight}px`;
        rosterDiv.style.overflowY = 'auto';
        rosterDiv.style.backgroundColor = this.COLORS.panel;
        rosterDiv.style.border = `1px solid ${this.COLORS.border}`;
        rosterDiv.style.padding = '10px';
        rosterDiv.style.boxSizing = 'border-box';
        rosterDiv.id = 'admin-roster';

        this.rosterElement = this.add.dom(rosterX, rosterY + 30, rosterDiv).setOrigin(0, 0);
        this.UIContainer.add(this.rosterElement);

        this.updateRoster();
    }

    private updateRoster(): void {
        if (!this.rosterElement) return;
        const rosterDiv = this.rosterElement.node as HTMLElement;
        if (!rosterDiv) return;

        const players = Array.from(this.playerConfigs.values());
        
        if (players.length === 0) {
            rosterDiv.innerHTML = `<div style="color: ${this.COLORS.textDim}; font-family: ${this.FONTS.mono}; font-size: 14px; padding: 40px; text-align: center; border: 1px dashed ${this.COLORS.border};">NO ACTIVE CONNECTIONS</div>`;
            return;
        }

        let html = `<table style="width: 100%; border-collapse: collapse; font-family: 'Poppins', sans-serif; font-size: 13px; color: ${this.COLORS.text};">`;
        html += `<tr style="text-align: left; color: #8d979e; border-bottom: 2px solid #42434a;">
                    <th style="padding: 12px 8px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">IDENTIFIER</th>
                    <th style="padding: 12px 8px; text-align: right; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">COMMAND</th>
                 </tr>`;

        players.forEach(player => {
            html += `<tr style="border-bottom: 1px solid #2a2a2a; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 12px 8px; font-weight: 600; color: ${this.COLORS.text};">${player.name.toUpperCase()}</td>
                        <td style="padding: 12px 8px; text-align: right;">
                            <button 
                                onclick="window.phaserAdminKick('${player.sessionID}')"
                                style="background-color: #b53c38; color: white; border: none; padding: 6px 8px; border-radius: 4px; cursor: pointer; font-family: 'Poppins', sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: filter 0.2s;"
                                onmouseover="this.style.filter='brightness(1.2)'"
                                onmouseout="this.style.filter='brightness(1.0)'"
                            >KICK</button>
                        </td>
                     </tr>`;
        });

        html += `</table>`;
        rosterDiv.innerHTML = html;

        // Expose kick function to window for the HTML buttons
        (window as any).phaserAdminKick = (sessionID: string) => {
            console.log('Admin:: Kicking player:', sessionID);
            this.socket.emit('host:kickplayer', sessionID);
        };
    }

    protected handlePlayerConnect(playerConfig: PlayerConfig): void {
        super.handlePlayerConnect(playerConfig);
        this.updateRoster();
        this.logEvent(`PLAYER JOINED: ${playerConfig.name.toUpperCase()}`, 'player');
    }

    protected handlePlayerDisconnect(sessionID: string): void {
        const player = this.playerConfigs.get(sessionID);
        const name = player ? player.name.toUpperCase() : 'UNKNOWN';
        
        // In Admin view, we remove players immediately when they disconnect
        // to keep the roster clean and focused on active participants.
        this.playerConfigs.delete(sessionID);
        this.updateRoster();
        this.logEvent(`PLAYER LEFT: ${name}`, 'player');
    }

    private createEventFeed(): void {
        const feedX = 360;
        const feedY = 500;
        const feedWidth = 340;
        const feedHeight = 480;

        const feedHeader = this.add.text(feedX, feedY, 'SYSTEM EVENT FEED', {
            fontFamily: this.FONTS.mono,
            fontSize: '14px',
            color: this.COLORS.textDim
        });
        this.UIContainer.add(feedHeader);

        const feedDiv = document.createElement('div');
        feedDiv.style.width = `${feedWidth}px`;
        feedDiv.style.height = `${feedHeight}px`;
        feedDiv.style.overflowY = 'auto';
        feedDiv.style.backgroundColor = this.COLORS.panel;
        feedDiv.style.border = `1px solid ${this.COLORS.border}`;
        feedDiv.style.padding = '10px';
        feedDiv.style.boxSizing = 'border-box';
        feedDiv.style.fontFamily = this.FONTS.mono;
        feedDiv.style.fontSize = '14px';
        feedDiv.style.color = this.COLORS.textDim;
        feedDiv.id = 'admin-event-feed';

        this.eventFeedElement = this.add.dom(feedX, feedY + 30, feedDiv).setOrigin(0, 0);
        this.UIContainer.add(this.eventFeedElement);

        this.logEvent('SYSTEM INITIALIZED', 'system');
    }

    private logEvent(message: string, type: 'system' | 'game' | 'player' = 'game'): void {
        const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        let color = this.COLORS.textDim;
        if (type === 'system') color = this.COLORS.accent;
        if (type === 'player') color = this.COLORS.success;
        if (type === 'game') color = '#ffcc00'; // Gold for game states

        const entry = `<div style="margin-bottom: 4px; line-height: 1.4;">
            <span style="color: #555;">[${timestamp}]</span> 
            <span style="color: ${color}; font-weight: bold;">${message}</span>
        </div>`;
        
        this.eventLog.push(entry);
        if (this.eventLog.length > 100) this.eventLog.shift();

        if (this.eventFeedElement) {
            const div = this.eventFeedElement.node as HTMLElement;
            div.innerHTML = this.eventLog.join('');
            div.scrollTop = div.scrollHeight;
        }
    }

    private setupGameEventListeners(): void {
        const events = [
            { event: 'server:introquiz', label: 'QUIZ INTRO' },
            { event: 'server:openingcredits', label: 'OPENING CREDITS' },
            { event: 'server:introround', label: 'ROUND INTRO' },
            { event: 'server:question', label: 'QUESTION STARTED' },
            { event: 'server:waitingforstream', label: 'WAITING FOR STREAM' },
            { event: 'server:collectanswers', label: 'COLLECTING ANSWERS' },
            { event: 'server:showanswer', label: 'SHOWING ANSWER' },
            { event: 'server:updatescores', label: 'SCORES UPDATED' },
            { event: 'server:endquestion', label: 'QUESTION ENDED' },
            { event: 'server:endround', label: 'ROUND ENDED' },
            { event: 'server:endquiz', label: 'QUIZ COMPLETE' }
        ];

        events.forEach(e => {
            this.socket.on(e.event, (data: any) => {
                let msg = e.label;
                if (data && data.title) msg += `: ${data.title.toUpperCase()}`;
                if (data && data.questionNumber) msg += ` (Q${data.questionNumber})`;
                this.logEvent(msg, 'game');
            });
        });

        this.socket.on('server:questionanswered', (data: { sessionID: string }) => {
            const player = this.playerConfigs.get(data.sessionID);
            if (player) {
                this.logEvent(`ANSWER RECEIVED: ${player.name.toUpperCase()}`, 'player');
            }
        });
    }

    private updateHostPreviewUI(): void {
        if (!this.UIContainer) return;

        if (this.previewBorder) this.previewBorder.destroy();
        if (this.previewLabel) this.previewLabel.destroy();
        if (this.liveIndicator) this.liveIndicator.destroy();

        const scale = 0.6;
        const width = 1920 * scale;
        const height = 1080 * scale;
        const x = 1920 - width - 40;
        const y = 40;

        this.previewBorder = this.add.graphics();
        this.previewBorder.lineStyle(4, 0x333333, 1);
        this.previewBorder.strokeRect(x - 2, y - 2, width + 4, height + 4);
        this.UIContainer.add(this.previewBorder);

        this.previewLabel = this.add.text(x, y - 25, 'MONITOR 01 // HOST OUTPUT', {
            fontFamily: this.FONTS.mono,
            fontSize: '12px',
            color: this.COLORS.textDim
        });
        this.UIContainer.add(this.previewLabel);

        if (this.isStreamMode) {
            this.liveIndicator = this.add.text(x + width - 50, y - 25, '● LIVE', {
                fontFamily: this.FONTS.mono,
                fontSize: '12px',
                color: this.COLORS.danger
            });
            this.UIContainer.add(this.liveIndicator);
        }
    }

    protected sceneShutdown(): void {
        console.log('QuizAdminScene:: sceneShutdown');
    }

    protected render(): void {
        console.log('QuizAdminScene:: render');
        this.updateHostPreviewUI();
    }

    public getPlayerBySessionID(sessionID: string): Phaser.GameObjects.Container {
        console.log('QuizAdminScene:: getPlayerBySessionID:', sessionID);
        return null as any;
    }
}
