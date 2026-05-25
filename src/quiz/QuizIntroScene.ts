import gsap from 'gsap';
import { CustomEase } from "gsap/CustomEase";
// CustomBounce requires CustomEase
import { CustomBounce } from "gsap/CustomBounce";
import Phaser from 'phaser';

gsap.registerPlugin(CustomEase,CustomBounce);



// --- Dev controls (change these while iterating, don't ship non-zero) ---
const DEV_SEEK = 0;    // jump to N seconds on start
const DEV_SPEED = 1;   // 1 = normal, 2 = double speed, 0.5 = slow-mo

const pubAassets: string[] = [
    '_0015_smallshelves.png',  '_0018_largeshelves.png', '_0003_pictures.png',    '_0007_dartboard.png', '_0002_barmanbald.png', '_0014_bar.png',           '_0017_smalltable.png',
'_0004_blackboard.png', '_0000_toupee.png',
'_0008_barstool1.png',  '_0008_barstool2.png',  '_0008_barstool3.png',  '_0008_barstool4.png', '_0008_barstool5.png',  
    '_0000_light1.png',      '_0000_light2.png',      '_0000_light3.png',      '_0000_light4.png',
'_0002_jukebox.png',    '_0006_tv.png',          '_0013_neonsign.png',   '_0003_lefttable.png',  '_0016_righttable.png'
];

const pubPositions: Record<string, {x: number, y: number, direction: string, offset?:number, duration?:number,ease?:string}> = {
"_0003_lefttable": {x:1440.5, y:1971, direction: 'down'},
"_0002_jukebox": {x:707, y:1454, direction: 'left'},
"_0013_neonsign": {x:1106, y:450, direction: 'up', offset:0.6},
"_0003_pictures": {x:1213, y:907, direction: 'up', offset:0.5},
"_0007_dartboard": {x:2002.5, y:796.5, direction: 'up', offset:0.5},
"_0015_smallshelves": {x:2438, y:820, direction: 'up', offset:0.3},
"_0008_barstool4": {x:3566, y:1883, direction: 'down', offset: 4 },
"_0008_barstool3": {x:3135, y:1835, direction: 'down', offset: 0.2},
"_0008_barstool2": {x:2704, y:1806, direction: 'down', offset: 0.2},
"_0008_barstool1": {x:2316, y:1781, direction: 'down', offset: 0.2},
"_0000_light4": {x:3676.5, y:308.5, direction: 'up', offset: 0 },
"_0000_light3": {x:3320, y:315, direction: 'up', offset: 0.2},
"_0000_light2": {x:2976, y:331, direction: 'up', offset: 0.2},
"_0000_light1": {x:2606, y:360, direction: 'up', offset: 0.2},
"_0018_largeshelves": {x:3404, y:870, direction: 'up'},
"_0016_righttable": {x:4601, y:2041., direction: 'down'},
"_0017_smalltable": {x:5445, y:1538, direction: 'right'},
"_0008_barstool5": {x:5107, y:1574, direction: 'right', offset: 0.2},
"_0006_tv": {x:4696, y:795, direction: 'up'},
"_0004_blackboard": {x:5426., y:783., direction: 'up'},

"_0014_bar": {x:3117, y:1547, direction: 'down', offset:1.7 },
"_0002_barmanbald": {x:2721, y:1134, direction: 'down', offset:0.2, ease: 'none'},
"_0000_toupee": {x:2714, y:923, direction: 'down', offset:0 },
}

const livingRoomAssets: string[] = [
    "_0002_cabinet.png", "_0014_tv.png",
"_0009_sidetable.png", "_0015_homesweethome.png",
 "_0010_pictures1.png", "_0019_hatstand.png", "_0011_pictures2.png",
"_0007_family.png", "_0012_lamp.png",
"_0008_armchair.png", "_0013_tvmask.png", "_0000_smalltvmask.png", "pubquiz-logo-HD.png"
];
const catAssets: string[] = [
        '_0001_cat.png', '_0002_catawake.png', '_0000_catstartled.png'
];

const livingRoomPositions: Record<string, {x: number, y: number, direction?: string, offset?:number, ease?:string}> = {
"_0009_sidetable": {x:709, y:1525, direction: 'down'},
"_0019_hatstand": {x:998, y:1257, direction: 'left' },
"_0012_lamp": {x:1459, y:1290, direction: 'up', offset: 1 },
"_0011_pictures2": {x:1163, y:528, direction: 'down', offset: 0.4},
"_0002_cabinet": {x:5209, y:1501, direction: 'right', offset:6},
"_0015_homesweethome": {x:5215, y:615, direction: 'down'},
"_0014_tv": {x:3622, y:754, direction: 'up', offset: 1.4 },
"_0013_tvmask": {x:3622, y:736, direction: 'none', offset: 0 },
"_0000_smalltvmask": {x:3622, y:736, direction: 'none', offset: 0 },
"pubquiz-logo-HD": { x: 3622, y: 736, direction: 'none', offset:0 },
"_0010_pictures1": {x:2377, y:778, direction: 'down', offset: 1 },
"_0008_armchair": {x:1953, y:1383, direction: 'up'},
"cat-animation": {x:2049, y:1409, direction: 'up' },
"_0007_family": {x:3299, y:1670, direction:'down' },
}

// ------------------------------------------------------------------------

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
 *
 * Dev mode:
 *  - Add ?dev=intro to the host URL to start this scene standalone (no server needed).
 *  - Hit R to replay the animation with the current mock data.
 *  - Adjust DEV_SEEK / DEV_SPEED constants above to skip ahead or change playback rate.
 */
export class QuizIntroScene extends Phaser.Scene {

    static readonly KEY = 'QuizIntroScene';

    private introMusic: Phaser.Sound.WebAudioSound | null = null;
    private mainContainer: Phaser.GameObjects.Container;
    private topContainer: Phaser.GameObjects.Container;
    private introTimeline: gsap.core.Timeline | null = null;
    private devHud: Phaser.GameObjects.Text | null = null;
    private logicalHeight: number = 1080;
    // Scale factor applied to all assets so they fit the logical canvas.
    // Computed once per playIntro() from the background image dimensions.
    private effectiveScale: number = 1;
    // All scene images keyed by asset name — populated in playIntro(), accessible everywhere.
    private images: { [key: string]: Phaser.GameObjects.Image } = {};

    constructor() {
        super(QuizIntroScene.KEY);
    }

    preload(): void {

        this.load.image('pub-background', '/assets/quiz/pub-elements/background.png');
        this.load.image('livingroom-background', '/assets/quiz/livingroom-elements/background.png');

        for (const asset of pubAassets) {
            const assetKey = asset.split('.png')[0];
            this.load.image(assetKey, `/assets/quiz/pub-elements/${asset}`);
        }

        for (const asset of livingRoomAssets) {
            const assetKey = asset.split('.')[0];
            this.load.image(assetKey, `/assets/quiz/livingroom-elements/${asset}`);
        }
        for(const asset of catAssets) {
            const assetKey = asset.split('.png')[0];
            this.load.image(assetKey, `/assets/quiz/livingroom-elements/${asset}`);
        }

        // this.load.audio('quiz-music-intro', '/assets/audio/quiz/music/modern-beat-jingle-intro-149598.mp3');
        // this.load.audio('quiz-music-intro', '/assets/audio/quiz/music/quiz-openingcredits1.mp3');
        this.load.audio('quiz-music-intro', '/assets/audio/quiz/music/quiz-openingcredits-33.m4a');

    }

    create(): void {
        this.setupCamera();
        this.scale.on('resize', this.setupCamera, this);
        this.mainContainer = this.add.container(0, 0);
        this.topContainer = this.add.container(0, 0);

        // When woken from sleep, receive fresh data and replay the animation.
        this.events.on('wake', (_sys: any) => {
            this.playIntro();
        });

        // Dev mode keyboard controls. HUD shows timeline position.
        if (__DEV__) {
            // R — replay from start
            this.input.keyboard?.on('keydown-R', () => {
                this.playIntro();
            });
            // SPACE — toggle play/pause
            this.input.keyboard?.on('keydown-SPACE', () => {
                if (!this.introTimeline) return;
                if (this.introTimeline.paused()) {
                    this.introTimeline.play();
                } else {
                    this.introTimeline.pause();
                }
            });
            // LEFT/RIGHT — step ±1 second (works while paused too)
            this.input.keyboard?.on('keydown-LEFT', () => {
                if (!this.introTimeline) return;
                this.introTimeline.seek(Math.max(0, this.introTimeline.time() - 1));
            });
            this.input.keyboard?.on('keydown-RIGHT', () => {
                if (!this.introTimeline) return;
                this.introTimeline.seek(Math.min(this.introTimeline.duration(), this.introTimeline.time() + 1));
            });

            this.devHud = this.add.text(10, 10, '', {
                fontFamily: 'monospace',
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#000000aa',
                padding: { x: 8, y: 5 }
            }).setDepth(100).setScrollFactor(0);

            // C — toggle corner picker mode
            this.input.keyboard?.on('keydown-C', () => {
                this.devToggleCornerPicker();
            });
        }

        // Play immediately on first launch.
        // Fall back to mock data when running standalone in dev mode.
        this.playIntro();


    }

    // Mirrors BaseScene camera setup — fixes the logical coordinate space to 1920px wide.
    private setupCamera(): void {
        console.log('Camera setup - window innerWidth:', window.innerWidth, 'innerHeight:', window.innerHeight, 'pixelRatio:', window.devicePixelRatio);
        console.log('Camera setup — display width:', this.scale.width, 'display height:', this.scale.height);

        const zoom = this.scale.width / 1920;
        this.cameras.main.setOrigin(0, 0);
        this.cameras.main.setZoom(zoom);
        this.logicalHeight = this.scale.height / zoom;

        console.log('Camera setup — zoom:', zoom.toFixed(2), 'logicalHeight:', Math.round(this.logicalHeight), 'display width:', this.scale.width, 'display height:', this.scale.height);
    }

    // Scales a logical 1080p y-value to the logical screen height (handles non-16:9 displays).
    private getY(logicalY: number): number {
        return logicalY * (this.logicalHeight / 1080);
    }

    private playIntro(): void {

        // totalDuration is determined by the choice of music
        // Timeline will be adjusted to ensure it fits exactly with the length of music
        // Track is 33 seconds but timeline must end 4 seconds before end to allow for the two zooms
        const totalDuration = 33 - 4;

        if (this.introTimeline) {
            this.introTimeline.kill();
        }
        if (this.introMusic) {
            this.introMusic.stop();
            this.introMusic.destroy();
            this.introMusic = null;
        }
        this.mainContainer.removeAll(true);

        this.introTimeline = gsap.timeline();
        const tl = this.introTimeline;

        this.introMusic = this.sound.add('quiz-music-intro') as Phaser.Sound.WebAudioSound;
        this.introMusic.play( { volume: 0.8, loop: false } );

        // bg lives at local (0,0) inside the container — no scale on the image itself.
        // The container handles all scaling and positioning, so every child coordinate
        // is in image-pixel space (0,0 = bg top-left corner at native resolution).
        const pubBG = this.add.image(0, 0, 'pub-background').setOrigin(0, 0).setAlpha(1);

        const fitWidthScale = Math.min(1920 / pubBG.width, this.logicalHeight / pubBG.height);
        const fitHeightScale = Math.max(1920 / pubBG.width, this.logicalHeight / pubBG.height);
        this.effectiveScale = fitHeightScale;
        // this.effectiveScale = fitWidthScale;
        const bgWorldW = pubBG.width * this.effectiveScale;
        const bgWorldH = pubBG.height * this.effectiveScale;
        const containerX = 1920 - bgWorldW;
        const containerY = 0;

        // Container positioned so bg fills screen vertically, right-aligned (pans left).
        // All children use image-pixel coords — scale once here, everything follows.
        this.mainContainer.setScale(this.effectiveScale);
        this.mainContainer.add(pubBG);
        console.log('fitHeightScale:', fitHeightScale.toFixed(4), ' containerXY:', Math.round(containerX), Math.round(containerY), "mainContainer pos:", { x: this.mainContainer.x, y: this.mainContainer.y });

        // Add the living room background here so it appears directly above pub but below all pub assets
        // Then add the mask and it will be ready to start tweening the paint reveal to reveal the living room
        const livingRoomBG = this.add.image(0, 0, 'livingroom-background').setOrigin(0, 0).setAlpha(1);
        const maskGraphics = this.make.graphics();
        livingRoomBG.enableFilters();
        // Use external (screen-space) mask so brush strokes painted in world coords align correctly.
        // filters.internal would apply the mask in the object's own local framebuffer (pre-transform),
        // causing a scale mismatch when the parent container has effectiveScale != 1.
        livingRoomBG.filters.external.addMask(maskGraphics);
        // livingRoomBG.setVisible(false);

        this.mainContainer.add(livingRoomBG);

        // Pan from right to left instead
        this.mainContainer.setPosition(containerX, containerY);
        // this.mainContainer.setPosition(0,0);


        // Assets at image-pixel coordinates — no setScale, container handles it.
        this.images = {};
        pubAassets.forEach((asset, index) => {
            const assetKey = asset.split('.png')[0];
            // console.log('Adding asset:', assetKey, 'with position from pubPositions:', pubPositions[assetKey]);
            const pos = pubPositions[assetKey] ?? { x: 100, y: 100 };
            const img = this.add.image(pos.x, pos.y, assetKey).setOrigin(0.5);
            this.mainContainer.add(img);
            // this.devDraggable(img);
            if (this.images[assetKey] !== undefined) {
                console.warn(`Duplicate asset key ${assetKey} at index ${index} — check for duplicate filenames in pubAassets and ensure all keys in pubPositions are unique`);
            }
            this.images[assetKey] = img;
        });

        livingRoomAssets.forEach((asset, index) => {
            const assetKey = asset.split('.')[0];
            const pos = livingRoomPositions[assetKey] ?? { x: 100, y: 100 };
            const img = this.add.image(pos.x, pos.y, assetKey).setOrigin(0.5);
            this.mainContainer.add(img);
            this.devDraggable(img);
            if (this.images[assetKey] !== undefined) {
                console.warn(`Duplicate asset key ${assetKey} at index ${index} — check for duplicate filenames in pubAassets and ensure all keys in pubPositions are unique`);
            }
            this.images[assetKey] = img;

            // Extra tweak since we are adding a custom bounce in the tween
            // We need to set the transform origin to top, bottom, right or left based on the direction they tween
            // Otherwise they will scale from the center and it will look weird with the bounce
            // If UP then asset arrives from UP position so origin must be centre bottom, etc...
            switch (pos.direction) {
                case 'up':
                    console.log('Transform origin: UP - ', assetKey);
                    img.setPosition(pos.x, pos.y + img.displayHeight / 2);
                    img.setOrigin(0.5, 1);
                    break;
                case 'down':
                    img.setPosition(pos.x, pos.y - img.displayHeight / 2);
                    img.setOrigin(0.5, 0);
                    break;
                case 'left':
                    img.setPosition(pos.x + img.displayWidth / 2, pos.y);
                    img.setOrigin(1, 0.5);
                    break;
                case 'right':
                    img.setPosition(pos.x - img.displayWidth / 2, pos.y);
                    img.setOrigin(0, 0.5);
                    break;
                default:
                    img.setOrigin(0.5);
            }
        });

        // Assemble the cat assets into an animation sequence
        // Define the animation once (safe to call on replay — exists check prevents duplicate)
        if (!this.anims.exists('cat-animation')) {
            this.anims.create({
                key: 'cat-animation',
                frames: catAssets.map(asset => ({ key: asset.split('.png')[0] })),
                frameRate: 1.2,   // 3 frames at 2fps = 1.5s per cycle — feels natural for a cat
                yoyo: true,
                repeat: 1
            });
        }
        const pos = livingRoomPositions['cat-animation'] ?? { x: 100, y: 100 };
        const catAnimation = this.add.sprite(pos.x, pos.y, catAssets[0].split('.png')[0]).setOrigin(0.5);
        catAnimation.setOrigin(0.5, 1);
        this.images['cat-animation'] = catAnimation;
        this.mainContainer.add(catAnimation);
        // this.devDraggable(catAnimation);

        // Make logo image invisible for now - only make visible once sequence has completed
        const logoImage = this.images['pubquiz-logo-HD'];
        logoImage.setVisible(false);
        // Same for tv mask images - this is only used as a placeholder for the mask
        const maskImage = this.images['_0013_tvmask'];
        maskImage.setVisible(false);
        const smallMaskImage = this.images['_0000_smalltvmask'];
        smallMaskImage.setVisible(false);

        // BEGIN TIMELINE BUILD
        tl.addLabel('introPan', 2);
        tl.addLabel('pubAssets', "5.5");
        tl.addLabel('livingRoomAssets', "9");
        tl.addLabel('startPainting', "9");
        tl.addLabel('outroPan', "12");

        tl.to( this.mainContainer, {
            x: 0,
            duration: 5,
            ease: 'quad.in'
        }, "introPan");


        // TWEEN PUB ASSETS OFF STAGE
        // Treat the tweens as separate from the addition of the assets so they can be sequenced using the order of the pubPositions array
        const defaultOffset = 0.8;
        let totalOffset = 0;
        for (const assetKey of Object.keys(pubPositions)) {
            const asset = pubPositions[assetKey];
            const img = this.images[assetKey];
            const tween = this.addExitTween(img, assetKey);
            const offset = (asset.offset == undefined) ? defaultOffset : asset.offset;
            totalOffset += offset;
            tl.add(tween, `pubAssets+=${totalOffset}`);

            // Special case for the toupee - just to draw attention to it otherwise it gets lost
            if (assetKey === '_0000_toupee') {
                tl.to( img, {
                    scaleX: 1.2,
                    scaleY: 1.2,
                    duration: 0.2
                }, `pubAssets+=${totalOffset}`);
                tl.to( img, {
                    rotate: 15,
                    duration: 0.4,
                    ease: 'back.inOut'
                }, `pubAssets+=${totalOffset}`);
            }
        };

        // TWEEN LIVING ROO ASSETS ONTO STAGE
        //Create a custom bounce ease:
        CustomBounce.create("myBounce", {
            strength: 0.3,  // Affects number of bounces (0-1) default 0.7
            squash: 2,      // Affects how much time the object spends in a squashing state when it hits the ground (2-4 a good range) default 0  
            squashID: "myBounce-squash",
        });

        totalOffset = 0;
        for (const assetKey of Object.keys(livingRoomPositions)) {
            const asset = livingRoomPositions[assetKey];
            const img = this.images[assetKey];
            const tween = this.addEntranceTween(img, assetKey);
            const offset = (asset.offset == undefined) ? defaultOffset : asset.offset;
            totalOffset += offset;
            tl.add(tween, `livingRoomAssets+=${totalOffset}`);

            // SPECIAL CASE - cat animation: start frame cycling once entrance tween finishes
            if (assetKey === 'cat-animation') {
                tween.eventCallback('onComplete', () => {
                    catAnimation.play('cat-animation');
                });
            }
        };


        // Tween entire container back to the right
        tl.to( this.mainContainer, {
            x: containerX,
            duration: 8
        }, "outroPan");

        // Zig-zag paint-roller reveal for the living room.
        tl.add(this.zigZagReveal(maskGraphics, 1920), "startPainting");


        // Hold for a beat then signal completion.
        tl.call(() => this.onIntroComplete(), [], '+=1');

        console.log('Total timeline duration:', tl.duration().toFixed(2), 'seconds (will be scaled to fit music length of', totalDuration, 'seconds)');
        // Adjust overall timelines speed to fit the music
        tl.timeScale(tl.duration() / totalDuration);
        // tl.pause();

        // Dev controls — adjust DEV_SEEK / DEV_SPEED constants at top of file.
        // if (DEV_SPEED !== 1) tl.timeScale(DEV_SPEED);
        if (DEV_SEEK > 0) {
            tl.seek(DEV_SEEK);
            // tl.seek() uses unscaled time; music uses real seconds. Divide by timeScale to sync.
            if (this.introMusic) {
                this.introMusic.setSeek(DEV_SEEK / tl.timeScale());
            }
        }
    }

    update(): void {
        if (!this.devHud || !this.introTimeline) return;
        const tl = this.introTimeline;
        const t = tl.time().toFixed(2);
        const d = tl.duration().toFixed(2);
        const speedLabel = tl.timeScale() !== 1 ? `  x${tl.timeScale()}` : '';
        const state = tl.paused() ? '⏸' : tl.isActive() ? '▶' : tl.progress() >= 1 ? '■' : '○';
        this.devHud.setText(`${state}  ${t}s / ${d}s${speedLabel}`);
    }

    // addExitTween
    // A function that will generate an entire timeline for tweening an asset onto or off the stage
    // Decides which direction it should tween by the initial position
    // Tweens the x or y value depending on the direction
    // Adds a vertical or horizontal scale to give a cartoon stretch/squash during the sequence
    addExitTween(img: Phaser.GameObjects.Image, assetKey: string): gsap.core.Timeline {

        const asset = pubPositions[assetKey];

        const tl = gsap.timeline();

        const direction = asset.direction?? 'up';
        const ease = asset.ease ?? 'back.inOut';

        // console.log('Asset:', asset, img, direction, ease);

        // First decide if we are tweening up down left or right by the position
        const fullWidth:number = 5760;
        const bounceScale = 1.2;
        const duration = asset.duration ?? 0.8;

        if (direction === 'left' || direction === 'right') {
            tl.to(img, {
                x: direction === 'left' ? - img.displayWidth : fullWidth + img.displayWidth,
                duration: duration,
                ease: ease
            });
            tl.to(img, {
                scaleX: bounceScale,
                duration: duration,
                ease: ease,
            });
        } else {
            tl.to(img, {
                y: direction === 'up' ? - img.displayHeight : this.getY(1080) / this.effectiveScale + img.displayHeight,
                duration: duration,
                ease: ease
            });
            tl.to(img, {
                scaleY: bounceScale,
                duration: duration,
                ease: ease,
            });
        }
        return tl;
    }

    // addEntranceTween
    // A function that will generate an entire timeline for tweening an asset onto or off the stage
    // Decides which direction it should tween by the initial position
    // Tweens the x or y value depending on the direction
    // Adds a vertical or horizontal scale to give a cartoon stretch/squash during the sequence
    addEntranceTween(img: Phaser.GameObjects.Image, assetKey: string): gsap.core.Timeline {

        const asset = livingRoomPositions[assetKey];
        let ease = 'back.out';

        const tl = gsap.timeline();

        const direction = asset.direction?? 'up';

        // console.log('Asset:', asset, img, direction, ease);

        // First decide if we are tweening up down left or right by the position
        const fullWidth:number = 5760;
        const duration = 1;

        if (direction === 'left' || direction === 'right') {
            tl.from(img, {
                x: direction === 'left' ? - img.displayWidth : fullWidth + img.displayWidth,
                duration: duration,
                ease: 'myBounce'
            });
            tl.to(img, {
                duration: duration,
                scaleX: 0.6,
                scaleY: 1.2,
                ease: "myBounce-squash",
            }, "<");
        } else {
            tl.from(img, {
                y: direction === 'up' ? - img.displayHeight : this.getY(1080) / this.effectiveScale + img.displayHeight,
                duration: duration,
                ease: 'myBounce'
            });
            tl.to(img, {
                duration: duration,
                scaleX: 1.2,
                scaleY: 0.6,
                ease: "myBounce-squash",
            }, "<");
        }
        return tl;
    }

    // Darkens (negative amount) or lightens (positive amount) a hex colour by shifting each RGB channel.
    private shadeColor(hex: number, amount: number): number {
        const r = Math.min(255, Math.max(0, ((hex >> 16) & 0xff) + amount));
        const g = Math.min(255, Math.max(0, ((hex >> 8)  & 0xff) + amount));
        const b = Math.min(255, Math.max(0, ( hex        & 0xff) + amount));
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Reveals the living room background by tweening a paint-roller brush along a
     * zig-zag path of slightly off-vertical stripes, drawing into a BitmapMask.
     *
     * All tweakable knobs live at the top of the method — adjust and reload.
     *
     * Coordinate space: world-space (x: 0–1920, y: 0–logicalHeight).
     * The mask graphics is drawn in world space, revealing wherever the brush passes.
     */
    private zigZagReveal(maskGfx: Phaser.GameObjects.Graphics, totalWidth: number): gsap.core.Timeline {
        // ── Tweak these ────────────────────────────────────────────────────────
        let stripeWidth  = 145;    // horizontal gap between columns (px) — ≤ brushW/2 ensures double coverage
        const strokeLen    = 260;   // length of each roller stroke (px) — ~¼ screen height
        const strokeStep   = 130;   // net upward advance per stroke pair (< strokeLen = overlapping steps)
        const slant        = 124;    // x-drift per stroke for a slight off-vertical tilt
        let   brushW       = 180;   // ellipse brush width
        let   brushH       = 80;   // ellipse brush height
        const brushAlpha   = 0.65;  // per-daub alpha — two overlapping passes → ~0.88, three → ~0.96
        const speed        = 3200;  // px / second
        // ───────────────────────────────────────────────────────────────────────

        // Overshoot top/bottom so the brush fully covers the edges.
        const topY    = -brushH;
        const bottomY = this.logicalHeight + brushH;

        // ── Waypoint generator ─────────────────────────────────────────────────
        // Each column is painted in short roller strokes (strokeLen) that step
        // upward (or downward) by strokeStep at a time — like a painter's
        // back-and-forth motion working up the wall.
        //
        // Odd columns go up (bottom → top), even columns go down (top → bottom),
        // so the brush stays local and never makes a long diagonal jump.
        //
        // stripeWidth ≤ brushW/2 guarantees every pixel is hit at least twice.
        const points: { x: number; y: number }[] = [];

        const addUpwardColumn = (x: number) => {
            // Start below screen, step upward until we clear the top.
            let base = bottomY;
            while (base > topY - strokeLen) {
                points.push({ x,           y: base });              // stroke bottom
                points.push({ x: x + slant, y: base - strokeLen }); // stroke top
                base -= strokeStep;
            }
        };

        const addDownwardColumn = (x: number) => {
            // Mirror: start above screen, step downward.
            let base = topY;
            while (base < bottomY + strokeLen) {
                points.push({ x,           y: base });              // stroke top
                points.push({ x: x + slant, y: base + strokeLen }); // stroke bottom
                base += strokeStep;
            }
        };

        let col = 0;
        let colIndex = 0;
        while (col <= totalWidth + stripeWidth) {
            if (colIndex % 2 === 0) addUpwardColumn(col);
            else                    addDownwardColumn(col);
            col += stripeWidth;
            stripeWidth += 80;
            brushW += 80;
            brushH += 20;
            colIndex++;
        }

        // ── Tween the cursor through every waypoint at constant speed ──────────
        const cursor = { x: points[0].x, y: points[0].y };
        const timeline = gsap.timeline();

        console.log('scale.height:', this.scale.height, 'logicalHeight:', this.logicalHeight, 'Points:', points);

        let lastPoint:{x:number, y:number} = points[0];
        for (let p = 1; p < points.length; p++) {
            const to   = points[p];
            const prev = points[p - 1];
            const dist = Math.hypot(to.x - prev.x, to.y - prev.y);
            const dur  = dist / speed;

            timeline.to(cursor, {
                x: to.x,
                y: to.y,
                duration: dur,
                ease: 'none',
                onUpdate: () => {
                    if (cursor.x === lastPoint.x && cursor.y === lastPoint.y) {
                        console.log('Duplicate');
                        return;
                    }
                    if (Math.hypot(cursor.x - lastPoint.x, cursor.y - lastPoint.y) < 1) {
                        console.log('Too close');
                        return;
                    }
                    maskGfx.fillStyle(0xffffff, brushAlpha);
                    maskGfx.fillEllipse(cursor.x, cursor.y, brushW, brushH);
                    lastPoint = { x: cursor.x, y: cursor.y };
                },
            });
        }

        return timeline;
    }


    private devCornerPickerActive: boolean = false;
    private devCornerMarkers: Phaser.GameObjects.Arc[] = [];
    private devPickedPoints: { x: number, y: number }[] = [];

    // Toggle click-to-pin corner picker. Press C to start, click to place points, press C again to clear.
    private devToggleCornerPicker(): void {
        if (!__DEV__) return;
        if (this.devCornerPickerActive) {
            // Clear mode — remove markers and reset
            this.devCornerMarkers.forEach(m => m.destroy());
            this.devCornerMarkers = [];
            this.devPickedPoints = [];
            this.input.off('pointerdown', this.devOnPickerClick, this);
            this.devCornerPickerActive = false;
            console.log('Corner picker: cleared');
        } else {
            // Start mode
            this.devCornerPickerActive = true;
            this.devPickedPoints = [];
            this.input.on('pointerdown', this.devOnPickerClick, this);
            console.log('Corner picker: active — click to place points. Press C to clear.');
        }
    }

    private devOnPickerClick(p: Phaser.Input.Pointer): void {
        // Convert screen click → world space → image-pixel space (container-local).
        // Container local = (worldPos - container.position) / container.scale
        const zoom = this.cameras.main.zoom;
        const wx = p.x / zoom;
        const wy = p.y / zoom;
        const lx = Math.round((wx - this.mainContainer.x) / this.mainContainer.scaleX);
        const ly = Math.round((wy - this.mainContainer.y) / this.mainContainer.scaleY);
        this.devPickedPoints.push({ x: lx, y: ly });
        // Draw a red dot at the picked point
        const dot = this.add.circle(lx, ly, 8, 0xff0000).setDepth(200);
        this.devCornerMarkers.push(dot);
        // Draw a label with the point index
        const label = this.add.text(lx + 12, ly - 8, `${this.devPickedPoints.length}: (${lx}, ${ly})`, {
            fontFamily: 'monospace', fontSize: '14px', color: '#ff4444', backgroundColor: '#000000aa'
        }).setDepth(200);
        // Store label in markers array so C clears it too
        (this.devCornerMarkers as any[]).push(label);
        console.log(`Point ${this.devPickedPoints.length}: { x: ${lx}, y: ${ly} }`);
        console.log('All points so far:', JSON.stringify(this.devPickedPoints));
        console.log(`[debug] camera zoom: ${this.cameras.main.zoom.toFixed(3)}, effectiveScale: ${this.effectiveScale.toFixed(3)}, logicalHeight: ${Math.round(this.logicalHeight)}`);
    }

    private devDraggable(obj: Phaser.GameObjects.Text | Phaser.GameObjects.Image): void {
        if (!__DEV__) return;
        obj.setInteractive({ draggable: true, useHandCursor: true });
        this.input.setDraggable(obj);
        this.input.on('drag', (_p: any, go: any, x: number, y: number) => {
            go.setPosition(x, y);
        });
        this.input.on('dragend', (_p: any, go: any) => {
            // go.x / go.y are already container-local (image-pixel) coords — paste directly.
            const lx = Math.round(go.x);
            const ly = Math.round(go.y);
            console.log(`"${go.text ?? go.texture?.key}": {x:${lx}, y:${ly}},`);
        });
    }

    private onIntroComplete(): void {

        console.log('QuizIntroScene:: introComplete');

        // And for the TV screen we want the tvmask image to be a mask for the livingroom logo image behind it
        // Retrieve the actual image that was created in the playIntro function
        const maskImage: Phaser.GameObjects.Image = this.images["_0013_tvmask"];
        const logoImage: Phaser.GameObjects.Image = this.images["pubquiz-logo-HD"];
        console.log('MASK: ', maskImage, maskImage.displayWidth, 'LOGO:', logoImage, logoImage.scale);

        if (!maskImage) return;

        // We need to calculate a scale for the logo image
        // It is full-size at 1920 pixels wide
        // It is in a container scaled at effectiveScale
        // And it must occupy a width equal to tvMask display width (which is also in the same container)
        const logoScale = 1.1 * (maskImage.displayWidth) / 1920;
        logoImage.setScale(logoScale);

        // Extract full world-space transform before removing from container.
        // tx/ty = world position of local origin. scaleX/scaleY = world scale including
        // container scale AND any GSAP-modified local scale.
        const matrix = maskImage.getWorldTransformMatrix();
        // Remove from container so it's no longer a child of the scaled container.
        // Do NOT add it to the display list — BitmapMask calls renderWebGL() on the source
        // directly, so the source being on-screen would cause it to render visibly on top.
        this.mainContainer.remove(maskImage);
        maskImage.setPosition(matrix.tx, matrix.ty);
        maskImage.setScale(matrix.scaleX, matrix.scaleY);
        maskImage.setAlpha(1);
        // Keep visible=true so DynamicTexture.capture can render it for the filter mask.
        // maskImage is NOT on the display list (removed from container, never re-added),
        // so it won't appear on screen — only the filter will use it.
        // maskImage.setVisible(false);

        // Do the same for logo image - then we can ensure it scales/positions to exactly the right place with no join to next part of sequence
        this.mainContainer.remove(logoImage);
        this.add.existing(logoImage);
        logoImage.setPosition(matrix.tx, matrix.ty);
        logoImage.setScale( 1.1 * maskImage.displayWidth / 1920 );

        logoImage.enableFilters();
        // Use maskImage (game object) as the mask source, not the texture key.
        // The game object is rendered in world space (viewTransform='world' default),
        // so it aligns correctly with logoImage's world position.
        // external filter = screen/world space, matching maskImage's world transform.
        logoImage.filters.external.addMask(maskImage);

        // Now that the logo imaage has been masked by we can make it visible
        logoImage.setVisible(true);

        // Now we have to zoom into the TV screen by tweening mainContainer AND the mask at the same time
        // Both must move in lock-step to scale everything up and keep the logo inside the tv
        const translatePoint = { x: maskImage.x, y: maskImage.y };
        console.log('Translate point:', translatePoint);
        const finalScale = 1920 / (maskImage.width);

        const tl = gsap.timeline();
        tl.from( maskImage, {
            scaleY: 0.02,
            duration: 0.3,
            ease: 'quad.in',
        } );
        tl.to( this.mainContainer, {
            x: (this.mainContainer.x - translatePoint.x) * finalScale / this.effectiveScale + 960,
            y: (this.mainContainer.y - translatePoint.y) * finalScale / this.effectiveScale + this.getY(540),
            scaleX: finalScale,
            scaleY: finalScale,
            duration: 2,
            ease: 'expo.in'
        }, ">");
        tl.to( logoImage, {
            x: 960,
            y: this.getY(540),
            scaleX: 1,
            scaleY: 1,
            duration: 2,
            ease: 'expo.in',
        }, "<");
        tl.to( maskImage, {
            x: 960,
            y: this.getY(540),
            scaleX: finalScale,
            scaleY: finalScale,
            duration: 2,
            ease: 'expo.in'
        }, "<");
        tl.add(() => {

            // Remove the mask (Phaser 4: clear the external filter list)
            logoImage.filters.external.clear();
            maskImage.destroy();
            this.doFinalZoom();
        }, ">+1");

    }

    doFinalZoom(): void {

        const logoImage: Phaser.GameObjects.Image = this.images["pubquiz-logo-HD"];

        // Figure out where to place the small tv mask
        const tvMask = this.images["_0000_smalltvmask"];
        this.add.existing(tvMask);
        // this.devDraggable(tvMask);
        const tvMaskPosition = { "_0000_smalltvmask": {x:1497, y:607} };
        tvMask.setPosition(tvMaskPosition["_0000_smalltvmask"].x, tvMaskPosition["_0000_smalltvmask"].y);
        tvMask.setScale(0.5);

        // From above we really only need the position so that we can tween the logo image to leave the tv screen in centre
        const translatePoint = { x: tvMask.x, y: tvMask.y };
        const finalScale = 1920 / (tvMask.displayWidth);
        gsap.to( logoImage, {
            x: 960 + (960 - translatePoint.x) * finalScale,
            y: this.getY(540) + (this.getY(540) - translatePoint.y) * finalScale,
            scaleX: finalScale,
            scaleY: finalScale,
            duration: 2,
            ease: 'expo.in',
            onComplete: () => {
                // Cleanup and signal completion to host scene
                tvMask.destroy();
                logoImage.destroy();
                const hostScene = this.scene.get('QuizHostScene');
                if (hostScene) {
                    hostScene.events.emit('intro:complete');
                }
            }
        });

        // this.mainContainer.remove(logoImage);
        // logoImage.setPosition(960, this.getY(540));
        // logoImage.setScale(1);
        // this.add.existing(logoImage);

        this.mainContainer.removeAll(true);


        // Sleep rather than stop — preserves all objects so the scene can be woken for replay.
        // this.scene.sleep();
    }
}
