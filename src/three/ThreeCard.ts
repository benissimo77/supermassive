import Phaser from 'phaser';
import gsap from 'gsap';
import { ThreeChip } from './ThreeChip';

export class ThreeCard extends Phaser.GameObjects.Container {
    
    private id: number;
    private flipped: boolean = false;
    private frontTexture: string;
    private backTexture: string;
    private plane: Phaser.GameObjects.Plane;
    private selectionChip: ThreeChip;
    private selectionText: Phaser.GameObjects.Text;
    private selectionNumber: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, backTexture: string, id: number) {
        super(scene, x, y);
        
        this.id = id;
        this.backTexture = backTexture;

        // 1. Setup the 3D Plane child (Internal to the container)
        // We initialize the plane with the back texture
        // TODO - make plane size dynamic based on screen size - currently absolutely sized
        this.plane = scene.add.plane(0, 0, backTexture);
        this.plane.setDisplaySize(160, 160);
        this.add(this.plane);

        // 2. Setup the Selection Badge (Container with circle and text)
        this.selectionChip = new ThreeChip(scene, 20, -20);
        this.selectionChip.setVisible(false);
        this.add(this.selectionChip);


        // 3. Enable Input on the Container
        // Containers do not have a default size, so we must set one for the hit area to work
        this.setSize(160, 160);
        this.setInteractive({ useHandCursor: true });
        
        // Add pointer events for visual feedback
        this.on('pointerover', () => {
            this.scene.tweens.add({
                targets: this,
                scale: 1.05,
                duration: 100
            });
        });

        this.on('pointerout', () => {
            this.scene.tweens.add({
                targets: this,
                scale: 1,
                duration: 100
            });
        });

        this.on('pointerdown', () => {
            console.log('ThreeCard pointerdown:', this.id);
            this.emit('card-clicked', this.id);
        });
        
        // Add to scene
        scene.add.existing(this);
    }

    public getIconType(): string {
        return this.frontTexture || '';
    }

    /**
     * Sets the selection order (1, 2, or 3) and displays it.
     */
    public setSelection(order: number | null): void {
        this.selectionNumber = order || 0;
        if (this.selectionNumber > 0) {
            this.selectionChip.setVisible(true);
            this.selectionChip.setSelection(this.selectionNumber);
        } else {
            this.selectionChip.setVisible(false);
            this.selectionChip.setSelection(0);
        }
    }

    public getSelection(): number {
        return this.selectionChip.getSelection();
    }

    /**
     * Flips the card using GSAP on the internal Plane.
     * @param frontTexture The icon to flip to.
     * @param showFront If true, shows the icon (180deg). If false, shows the back (0deg).
     * @param duration Duration of the flip animation in SECONDS (GSAP standard).
     * @returns A GSAP Timeline for the animation.
     */
    public flip(frontTexture: string, showFront: boolean, duration: number = 0.5): gsap.core.Timeline {

        console.log('ThreeCard::flip called with:', { frontTexture, showFront, duration }, "rotateY:", this.plane.rotateY);

        // If a frontTexture is specified then use it, otherwise keep the current front texture
        if (frontTexture) this.frontTexture = frontTexture;
        
        // Hide selection badge immediately when a flip starts
        this.selectionChip.setVisible(false);

        // Normalize rotation to avoid infinite accumulation
        // If we are at 360, reset to 0 immediately before starting
        if (this.plane.rotateY >= 360) this.plane.rotateY = 0;

        // Calculate target: 180 (front) or 0 (back)
        const targetRotation = showFront ? 180 : 360;

        // set flipped right away so that state is correct when used in master timeline
        this.flipped = showFront;

        console.log('Card flipping from :', this.plane.rotateY, 'to', targetRotation, 'ending up flipped:', this.flipped);

        // CRITICAL BUGFIX: GSAP master timeline won't correctly play a nested child timeline 
        // if the child timeline is explicitly instantiated with { paused: true } and then added to a parent.
        // The master timeline expects unpaused timeline objects because it manages the playhead!
        const tl = gsap.timeline();

        // 1. Subtle scale "pop"
        // Target the container itself (this) to scale up and down
        tl.to(this, {
            scale: 1.1,
            duration: duration * 0.5,
            ease: "quad.out"
        });

        tl.to(this, {
            scale: 1,
            duration: duration * 0.5,
            ease: "quad.in"
        });

        // 2. The Rotation (on the Plane child)
        // With GSAP, proxying properties that might not have standard JS getters/setters 
        // can sometimes require targeting an object holding the value. 
        const proxy = { y: this.plane.rotateY };

        tl.to(proxy, {
            y: targetRotation,
            duration: duration,
            ease: "quad.inOut",
            onUpdate: () => {
                this.plane.rotateY = proxy.y;
                // Plane component in Phaser uses rotateY/rotateX in degrees
                const rotation = Math.abs(this.plane.rotateY % 360);
                const isFrontHalf = rotation > 90 && rotation < 270;
                
                const targetTex = isFrontHalf ? this.frontTexture : this.backTexture;
                
                if (this.plane.texture.key !== targetTex) {
                    this.plane.setTexture(targetTex);
                    // Reset display size after texture swap on Plane
                    this.plane.setDisplaySize(160, 160);
                }
            }
        }, 0);

        return tl;
    }

    public isFlipped(): boolean {
        return this.flipped;
    }
}
