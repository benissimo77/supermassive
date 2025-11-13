import { BaseScene } from "src/BaseScene";
import { SoundManager } from "src/audio/SoundManager";

declare global {
    interface Window {
        onYouTubeIframeAPIReady?: () => void;
        YT?: any;
    }
}

export class YouTubePlayerUI {
    // Static instance for singleton pattern
    private static instance: YouTubePlayerUI;

    // Player references
    private player: any = null;
    private isReady: boolean = false;
    private container: HTMLDivElement | null = null;
    private uniqueId: string = 'global-youtube-player';
    private playerHeight: number = 480;

    // UI references
    private activeControls: Phaser.GameObjects.Container | null = null;
    private playPauseBtn: Phaser.GameObjects.Image | null = null;
    private pauseIcon: Phaser.GameObjects.Image | null = null;
    private replayBtn: Phaser.GameObjects.Image | null = null;
    private statusText: Phaser.GameObjects.Text | null = null;
    private isPlaying: boolean = false;

    // Scene reference for creating UI elements
    private scene: BaseScene;
    private eventEmitter: Phaser.Events.EventEmitter;


    // Private constructor for singleton
    private constructor(scene: BaseScene) {
        this.scene = scene;
        this.eventEmitter = new Phaser.Events.EventEmitter();
        this.initPlayer();
    }

    // Get singleton instance
    public static getInstance(scene: BaseScene): YouTubePlayerUI {
        if (!YouTubePlayerUI.instance) {
            YouTubePlayerUI.instance = new YouTubePlayerUI(scene);
        } else {
            // Update scene reference if a different scene is provided
            //YouTubePlayerUI.instance.scene = scene;
        }
        return YouTubePlayerUI.instance;
    }

    // We use the canvas height when setting both height and width of player so it maintains its own aspect ratio
    // Note: we check for this.isReady to be safe, but this fn should only be called after a ready event has been received
    public setSize(height: number): void {
        this.playerHeight = height;
        if (this.isReady) {
            const iframe: HTMLElement | null = document.getElementById(this.uniqueId);
            const width: number = height * (16 / 9);
            const canvasH: number = this.scene.scale.getViewPort().height;
            const playerW: number = width * canvasH / 1080;
            const playerH: number = height * canvasH / 1080;
            if (iframe) {
                console.log('YouTubePlayerUI::setSize:', this.scene.TYPE, { width, height, ready: this.isReady, canvasH });
                iframe.style.width = `${playerW}px`;
                iframe.style.height = `${playerH}px`;
            }
        }
    }
    // Sets the position of the Player - converts from logical to DOM coordinates
    // Position supplied is top centre, but CSS must use left and top
    // NOTE: this relies on knowing the size of the player so call setSize first
    public setPosition(x: number, y: number): void {
        if (this.isReady) {
            const iframe: HTMLElement | null = document.getElementById(this.uniqueId);
            if (iframe) {
                const canvasW: number = this.scene.scale.getViewPort().width;
                const canvasH: number = this.scene.scale.getViewPort().height;
                // To calculate playerWidth we duplicate the code above in setSize to ensure we are using the same player size
                const height = this.playerHeight;
                const width: number = height * (16 / 9);
                const playerW: number = width * canvasH / 1080;
                // With above calculations duplicated we can calculate player left and top
                const playerC: number = x * canvasW / 1920;
                const playerLeft: number = playerC - playerW / 2;
                const playerTop: number = y * canvasH / 1080;
                console.log('YouTubePlayerUI::setPosition:', this.scene.TYPE, { x, y, playerLeft, playerTop });
                iframe.style.left = `${playerLeft}px`;
                iframe.style.top = `${playerTop}px`;
            }
        }
    }
    public once(event: string, fn: Function, context?: any): this {
        this.eventEmitter.once(event, fn, context);
        return this;
    }
    // Add this method to your YouTubePlayerUI class
    public isPlayerReady(): boolean {
        return this.isReady;
    }
    // Initialize the YouTube player
    private initPlayer(): void {
        // Create hidden container
        this.container = document.createElement('div');
        this.container.id = this.uniqueId;
        this.container.style.position = 'absolute';
        this.container.style.top = '-4000px';

        // Add to DOM
        document.body.appendChild(this.container);

        // Load YouTube API if needed
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            if (firstScriptTag) {
                firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
            } else {
                document.body.appendChild(tag);
            }

            // Handle API ready event
            window.onYouTubeIframeAPIReady = () => {
                this.initYouTubePlayer();
            };
        } else {
            // API already loaded
            this.initYouTubePlayer();
        }
    }

    // Initialize the YouTube player instance
    private initYouTubePlayer(): void {
        if (window.YT && window.YT.Player) {
            this.player = new window.YT.Player(this.uniqueId, {
                events: {
                    'onReady': this.handleReady.bind(this),
                    'onStateChange': this.handleStateChange.bind(this)
                }
            });
            console.log('YouTube player initialized');
        } else {
            console.warn('YouTube API not ready yet');
            setTimeout(() => this.initYouTubePlayer(), 500);
        }
    }


    // Handle player ready event
    private handleReady(): void {
        console.log('YouTube player ready');
        this.isReady = true;

        // We want to fire a ready event to let calling class know that iframe can be styled (size/position)
        // but we still need to give it some time to fully render the iframe...
        requestAnimationFrame(() => {
            setTimeout(() => {
                const iframe = document.getElementById(this.uniqueId);
                if (iframe && iframe.tagName === 'IFRAME') {
                    console.log('YouTube player iframe seems ok:', iframe);
                    this.eventEmitter.emit('ready', this);

                    // Regiseter player with soundManager for volume control
                    const soundManager = SoundManager.getInstance(this.scene);
                    soundManager.registerYouTubePlayer(this.player);

                } else {
                    console.warn('YouTube player iframe not ready yet, trying again in 100ms');
                }
            }, 100);
        });

    }

    // Handle player state change
    private handleStateChange(event: any): void {
        if (!this.activeControls) return;

        if (event.data === window.YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            this.updateUIForPlaying();
        } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
            this.isPlaying = false;
            this.updateUIForPaused();
        }
    }

    // Update UI to show playing state
    private updateUIForPlaying(): void {
        if (!this.playPauseBtn || !this.pauseIcon || !this.statusText) return;

        // this.playPauseBtn.setVisible(false);
        this.pauseIcon.setVisible(true);
        this.statusText.setText('Playing');

        // Visual feedback
        if (this.scene && this.playPauseBtn) {
            this.scene.tweens.add({
                targets: this.playPauseBtn,
                scale: { from: 1.1, to: 1 },
                duration: 200
            });
        }
    }

    // Update UI to show paused state
    private updateUIForPaused(): void {
        if (!this.playPauseBtn || !this.pauseIcon || !this.statusText) return;

        this.playPauseBtn.setVisible(true);
        this.pauseIcon.setVisible(false);
        this.statusText.setText('Play Audio');
    }

    // Create player UI and attach to a question
    public createPlayerUI(scene: BaseScene): Phaser.GameObjects.Container {
        this.scene = scene;

        // Create new controls
        const container = scene.add.container(0, 0);
        this.activeControls = container;

        // Background panel
        const bg = scene.add.rectangle(
            0,
            0,
            scene.getY(380),
            scene.getY(80),
            0x2c2c2c,
            0.9
        ).setOrigin(0.5);
        bg.setStrokeStyle(2, 0x444444);
        container.add(bg);

        // Play/Pause button
        const playPauseBtn: Phaser.GameObjects.Image = scene.add.image(0, 0, 'player-play');
        playPauseBtn.setOrigin(0.5);
        playPauseBtn.setInteractive({ useHandCursor: true });
        container.add(playPauseBtn);
        this.playPauseBtn = playPauseBtn;

        // Pause icon (initially hidden)
        const newPauseIcon = this.scene.add.image(0, 0, 'player-pause');
        newPauseIcon.setOrigin(0.5);
        container.add(newPauseIcon);
        this.pauseIcon = newPauseIcon;

        // Replay button
        const replayBtn: Phaser.GameObjects.Image = scene.add.image(-120, 0, 'player-replay');
        replayBtn.setOrigin(0.5);
        replayBtn.setInteractive({ useHandCursor: true });
        container.add(replayBtn);
        this.replayBtn = replayBtn;

        // Status text
        const statusConfig = {
            fontFamily: 'Arial',
            fontSize: scene.getY(16) + 'px',
            color: '#ffffff'
        }
        const statusText = scene.add.text(120, 0, 'Play Audio', statusConfig)
            .setOrigin(0, 0.5);
        container.add(statusText);
        this.statusText = statusText;

        // Set up event handlers
        this.setupEventHandlers();

        // Reflect current state
        if (this.isPlaying) {
            this.updateUIForPlaying();
        } else {
            this.updateUIForPaused();
        }

        return container;
    }

    // Set up event handlers for controls
    private setupEventHandlers(): void {
        if (!this.playPauseBtn || !this.replayBtn || !this.scene) return;

        // Clear any existing listeners
        this.playPauseBtn.removeAllListeners();
        this.replayBtn.removeAllListeners();

        // Play/Pause button
        this.playPauseBtn.on('pointerup', () => {
            this.togglePlayPause();

            this.scene?.tweens.add({
                targets: this.playPauseBtn,
                scale: { from: 0.9, to: 1 },
                duration: 100
            });
        });

        // Replay button
        this.replayBtn.on('pointerup', () => {
            this.replayAudio();

            this.scene?.tweens.add({
                targets: this.replayBtn,
                scale: { from: 0.9, to: 1 },
                duration: 100
            });
        });

    }

    // Toggle play/pause
    private togglePlayPause(): void {
        if (!this.player || !this.isReady) {
            console.warn('Player not ready yet');
            return;
        }

        if (this.isPlaying) {
            this.player.pauseVideo();
        } else {
            this.player.playVideo();
        }
    }

    // Replay audio from beginning or start time
    private replayAudio(): void {
        if (!this.player || !this.isReady) {
            console.warn('Player not ready yet');
            return;
        }

        const startTime = this.currentStartTime || 0;
        this.player.seekTo(startTime, true);
        this.player.playVideo();

        // Update UI
        if (this.statusText) {
            this.statusText.setText('Replaying...');
        }

        // Visual feedback
        if (this.scene && this.replayBtn) {
            this.scene.tweens.add({
                targets: this.replayBtn,
                fillColor: { from: 0x007722, to: 0x00aa44 },
                duration: 200
            });
        }
    }

    // Stop playing
    public stopVideo(): void {
        if (this.player && this.isReady) {
            try {
                this.player.stopVideo();
                this.isPlaying = false;
                this.updateUIForPaused();
            } catch (e) {
                console.warn('Error stopping video:', e);
            }
        }
    }

    // Current video start time
    private currentStartTime: number | null = null;

    // Load and play a video
    public loadVideo(YTurl: string): void {
        if (!this.player || !this.isReady) {
            console.warn('Player not ready yet, trying again in 500ms');
            setTimeout(() => this.loadVideo(YTurl), 500);
            return;
        }

        const { id: videoId, startTime } = this.extractYoutubeInfo(YTurl);
        if (!videoId) {
            console.error('Invalid YouTube URL:', YTurl);
            return;
        }

        this.currentStartTime = startTime;

        if (startTime !== null) {
            this.player.loadVideoById(videoId, startTime);
        } else {
            this.player.loadVideoById(videoId);
        }
    }
    /**
     * Extract YouTube video ID and optional start time from various YouTube URL formats
     * @param url YouTube URL
     * @returns Object containing video ID and optional start time
     */
    private extractYoutubeInfo(url: string): { id: string | null, startTime: number | null } {
        if (!url) return { id: null, startTime: null };

        // Extract video ID
        const idRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const idMatch = url.match(idRegExp);
        const videoId = (idMatch && idMatch[2].length === 11) ? idMatch[2] : null;

        // Extract start time (t or start parameter)
        let startTime = null;
        if (url.includes('t=') || url.includes('start=')) {
            const timeRegExp = /[?&](t|start)=([0-9]+)/;
            const timeMatch = url.match(timeRegExp);
            if (timeMatch && timeMatch[2]) {
                startTime = parseInt(timeMatch[2], 10);
            }
        }

        return { id: videoId, startTime: startTime };
    }


    // Stop and clean up everything - this is only used when scene is shutdown
    public destroy(): void {

        if (this.player) {
            try {
                this.player.stopVideo();
                this.player.destroy();
            } catch (e) {
                console.warn('Error destroying YouTube player:', e);
            }
        }

        const soundManager = SoundManager.getInstance(this.scene);
        soundManager.unregisterYouTubePlayer();

        const iframe: HTMLElement | null = document.getElementById(this.uniqueId);
        if (iframe) {
            document.body.removeChild(iframe);
        }

        this.player = null;

        // Remove the singleton instance
        YouTubePlayerUI.instance = null as any;
    }
}