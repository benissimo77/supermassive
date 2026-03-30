import { BaseScene } from "src/BaseScene";
import { PhaserPlayer, PlayerConfig, PhaserPlayerState } from '../quiz/PhaserPlayer';

export class ThreePlayer extends PhaserPlayer {
    private iconContainer: Phaser.GameObjects.Container;
    private icons: Map<string, Phaser.GameObjects.Image[]> = new Map();
    private isIconGridVisible: boolean = false;
    private playerConfig: PlayerConfig;

    private battleSlotBg: Phaser.GameObjects.NineSlice;
    private battleSlotHighlight: Phaser.GameObjects.NineSlice;

    // Grid Configuration
    private readonly ICON_SIZE = 40;
    private readonly ICON_SPACING = 42;
    private readonly MAX_ICON_TYPES = 5;

    // Slot Configuration
    private readonly BATTLESLOT_WIDTH = 560;
    private readonly BATTLESLOT_HEIGHT = 360;

    constructor(scene: BaseScene, playerConfig: PlayerConfig) {
        super(scene, playerConfig);

        this.playerConfig = playerConfig;

        // Background / Card Mode graphics (placed completely behind the player)
        // Since player origin is centre-line of their name panel we need to adjust position of background
        // MAX height of player avatar is 200px BUT 60px sits below the centre-line of name panel
        // Leaves only 200 - 60 = 140px above centre-line of name panel
        // So background must be -140 + half background height (background origin is (0,0.5))
        this.battleSlotBg = scene.add.nineslice(
            -40, -140 + this.BATTLESLOT_HEIGHT / 2, // Offset relative to player origin
            'selection-slot',
            undefined,
            this.BATTLESLOT_WIDTH, this.BATTLESLOT_HEIGHT,
            32, 32, 32, 32
        ).setOrigin(0, 0.5).setTint(0xaaaaaa).setVisible(false);

        this.battleSlotHighlight = scene.add.nineslice(
            -40, -140 + this.BATTLESLOT_HEIGHT / 2, // Same offset as background
            'selection-slot-highlight',
            undefined,
            this.BATTLESLOT_WIDTH, this.BATTLESLOT_HEIGHT,
            32, 32, 32, 32
        ).setOrigin(0, 0.5).setVisible(false);

        this.add([this.battleSlotBg, this.battleSlotHighlight]);

        // Create a sub-container for the collected icons
        // Positioned below the playernamepanel (which is roughly at y: 24)
        this.iconContainer = scene.add.container(0, 64 );
        this.add(this.iconContainer);
        this.setIconGridVisibility(false);

        // Wait for base class to finish async avatar/text creation
        this.once('player-setup-complete', () => {
            console.log('ThreePlayer:: Adjusting playerScoreText for player', playerConfig.sessionID);
            // Tweak the text object for the score now that it's guaranteed to exist
            // battleSlots are 560 wide with 40px border so right edge is at 480
            this.playerScoreText.
                setPosition(480, -52).
                setFontSize(64);
            this.setPlayerScoreText('');
        });
    }

    /**
     * Makes the entire player texture (avatar + panel) interactive.
     * Applies a subtle visual effect on hover/down and calls the callback when tapped.
     */
    public makeInteractive(onClick: () => void): void {
        this.once('player-setup-complete', () => {
            if (!this.playerTexture) return;

            let pointerDownFired = false;
            let currentFX: Phaser.FX.Glow | null = null;
            
            // Let's trace the origin logic from PhaserPlayer:
            // 1. The playernamepanel is added to a tempContainer at (0, 0) with an origin of (0, 0.5)
            // 2. The renderTexture is created with bounds (480, textureHeight)
            // 3. The origin of the renderTexture is set to (0, originY) where originY = (textureHeight - 60) / textureHeight
            // 4. The tempContainer is drawn into the texture at (0, textureHeight - 60).
            // Hit areas in Phaser are based on the unscaled base top-left of the texture, completely ignoring the object's setOrigin().
            // Thus, the pixel center of the nameplate inside the raw texture is exactly `textureHeight - 60`.
            const panelHeight = 60;
            const textureHeight = this.playerTexture.height;
            // A rectangle starting half the panel height above the center exactly covers the nameplate.
            const hitAreaY = (textureHeight - 60) - (panelHeight / 2);
            const hitArea = new Phaser.Geom.Rectangle(0, hitAreaY, 480, panelHeight);

            this.playerTexture
                .setInteractive({ 
                    hitArea: hitArea,
                    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                    useHandCursor: true 
                })
                .on('pointerover', () => {
                    // this.playerTexture.setTint(0xddddff);
                    if (!currentFX && this.playerTexture.postFX) {
                        // Trick to make glow look like a solid stroke: 
                        // High outerStrength (e.g. 4+), low distance (e.g. 2).
                        currentFX = this.playerTexture.postFX.addGlow(0xffff00, 4, 0, false, 0.5, 2);
                    }
                })
                .on('pointerout', () => {
                    // this.playerTexture.clearTint();
                    pointerDownFired = false;
                    if (currentFX && this.playerTexture.postFX) {
                        this.playerTexture.postFX.remove(currentFX);
                        currentFX = null;
                    }
                })
                .on('pointerdown', () => {
                    this.playerTexture.setTint(0xaaaaff); 
                    pointerDownFired = true;
                })
                .on('pointerup', () => {
                    this.playerTexture.setTint(0xddddff);
                    if (pointerDownFired) {
                        pointerDownFired = false;
                        onClick();
                    }
                });
        });
    }

    /**
     * Toggles the generic "Battle Slot" card background
     */
    public setCardMode(active: boolean): void {
        this.battleSlotBg.setVisible(active);
        // Ensure highlight is invisible if we are hiding the card mode
        if (!active) this.battleSlotHighlight.setVisible(false);
        // Push graphics to the bottom layer
        if (active) {
            this.sendToBack(this.battleSlotHighlight);
            this.sendToBack(this.battleSlotBg);
        }
    }

    /**
     * Toggles the yellow highlight border around the card
     */
    public setHighlighted(active: boolean): void {
        this.battleSlotHighlight.setVisible(active);
        // Sometimes drawing order means we need to ensure visibility updates cleanly
    }

    /**
     * Toggles the visibility of the collected icons grid.
     */
    public setIconGridVisibility(visible: boolean): void {
        this.isIconGridVisible = visible;
        this.iconContainer.setVisible(visible);
    }

    /**
     * Adds a collected icon to the player's grid.
     * Logic: Different icon types are placed next to each other horizontally (columns).
     * Matching icons of the same type are stacked vertically within their respective column.
     * This makes better use of horizontal space.
     */
    public addCollectedIcon(iconKey: string, pos: number, newTileCount:number): void {
        console.log(`ThreePlayer:: Adding collected icon ${iconKey} for player ${this.playerConfig.sessionID} at position ${pos} newTileCount: ${newTileCount}`);
        
        if (!this.icons.has(iconKey)) {
            // New type of icon (new column)
            if (this.icons.size >= this.MAX_ICON_TYPES) {
                console.warn('ThreePlayer:: Max icon types reached');
                return;
            }
            this.icons.set(iconKey, []);
        }

        const collectedOfThisType = this.icons.get(iconKey)!;
        const typeIndex = Array.from(this.icons.keys()).indexOf(iconKey);

        // If we already have this number of icons already collected then do nothing
        if (collectedOfThisType.length >= newTileCount) {
            console.log(`ThreePlayer:: Player ${this.playerConfig.sessionID} already has ${collectedOfThisType.length} icons of type ${iconKey}`);
            return;
        }
        // Create the icon image
        const icon = this.scene.add.image(
            typeIndex * this.ICON_SPACING + this.ICON_SIZE / 2,                // Horizontal for different types (Columns)
            collectedOfThisType.length * this.ICON_SPACING + this.ICON_SIZE / 2, // Vertical for matches (Stacking)
            iconKey
        ).setOrigin(0.5); // Align perfectly with the left edge of the container
        
        icon.setDisplaySize(this.ICON_SIZE, this.ICON_SIZE);
        
        this.iconContainer.add(icon);
        collectedOfThisType.push(icon);

        // Special case - for joker we always place in bottom corner of the grid
        if (iconKey === 'joker') {
            icon.setPosition(480 - this.ICON_SIZE/2, this.ICON_SIZE / 2);
            icon.setDisplaySize(this.ICON_SIZE * 1.2, this.ICON_SIZE * 1.2);
        } else {

            // Optional: Add a little "pop" animation when collected
            this.scene.tweens.add({
                targets: icon,
                scale: 1.2,
                duration: 200,
                yoyo: true,
                ease: 'Back.easeOut'
            });

        }

    }

    /**
     * Removes a collected icon from the player's grid.
     * Removes the last added icon of the given type.
     */
    public loseCollectedIcon(iconKey: string, pos: number): void {
        const collectedOfThisType = this.icons.get(iconKey);
        if (!collectedOfThisType || collectedOfThisType.length === 0) {
            console.warn(`ThreePlayer:: No icons of type ${iconKey} to remove`);
            return;
        }

        // Remove the last icon of this type (top of the stack)
        const icon = collectedOfThisType.pop();
        if (icon) {
            // "Poof" animation (scale down and fade out)
            this.scene.tweens.add({
                targets: icon,
                scale: 0,
                alpha: 0,
                duration: 300,
                ease: 'Power2.easeIn',
                onComplete: () => {
                    icon.destroy();
                }
            });
        }

        // If no icons of this type are left, we keep the entry in the Map 
        // to preserve the column index for future icons of the same type?
        // Actually, the current addCollectedIcon logic uses Array.from(this.icons.keys()).indexOf(iconKey)
        // so if we delete the key, indices of other types will shift. 
        // Better to check if we should keep it or if shifting is okay.
        // For now, let's keep the key so the "column" remains reserved.
    }

    /**
     * Clears all collected icons (e.g., at game reset)
     */
    public clearIcons(): void {
        this.iconContainer.removeAll(true);
        this.icons.clear();
    }
}
