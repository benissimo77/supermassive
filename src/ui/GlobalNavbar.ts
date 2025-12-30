import { BaseScene } from '../BaseScene';

export class GlobalNavbar extends Phaser.GameObjects.Container {

    private navbarHeight: number = 0;
    public scene: BaseScene;
    private iconsContainer: Phaser.GameObjects.Container;
    private visibleTimeout: number | null = null;
    private hideDelay = 1500;
    private isShown = false;

    public container: Phaser.GameObjects.Container;

    constructor(scene: BaseScene) {
        super(scene, 0, 0);
        this.scene = scene;
        this.navbarHeight = scene.getY(100);

        // create root container positioned off top initially
        this.container = this.scene.add.container(0, this.navbarHeight * -1);
        const bg = this.scene.add.rectangle(0, 0, 1920, this.navbarHeight, 0x000000, 0.9)
            .setOrigin(0, 0);
        this.iconsContainer = this.scene.add.container(1900, this.navbarHeight / 2);
        const returnText = this.scene.add.text(20, this.navbarHeight / 2, '← Return to Lobby', {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#ffffff'
        })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
        // default no-op; consumers can override
        returnText.on('pointerup', () => {
            this.scene.socket?.emit('host:requestgame', 'Lobby');
        });

        this.container.add([bg, returnText, this.iconsContainer]);

        // handle pointer movement on the scene (debounced show)
        this.scene.input.on('pointermove', this.onPointerMove, this);
    }

    private onPointerMove() {
        this.show();
    }

    showImmediate() {
        this.scene.tweens.killTweensOf(this.container);
        this.container.y = 0;
        this.isShown = true;
        if (this.visibleTimeout) {
            clearTimeout(this.visibleTimeout);
            this.visibleTimeout = null;
        }
    }

    show() {
        if (this.isShown) {
            // reset hide timer
            if (this.visibleTimeout) {
                clearTimeout(this.visibleTimeout);
            }
        } else {
            this.scene.tweens.add({
                targets: this.container,
                y: 0,
                duration: 220,
                ease: 'Power2'
            });
            this.isShown = true;
        }
        this.visibleTimeout = window.setTimeout(() => this.hide(), this.hideDelay);

        // Add to scene in order to bring to front
        this.scene.children.bringToTop(this.container);
    }

    hide() {
        this.scene.tweens.add({
            targets: this.container,
            y: this.navbarHeight * -1,
            duration: 300,
            ease: 'Power2'
        });
        this.isShown = false;
        if (this.visibleTimeout) {
            clearTimeout(this.visibleTimeout);
            this.visibleTimeout = null;
        }
    }

    // Add an icon (texture key) with callback
    addIcon(textureKey: string, callback: () => void, opts?: { tooltip?: string, size?: number }) {
        const size = opts?.size ?? 64;
        const gap = 20;
        const index = this.iconsContainer.list.length;
        const x = index * (size + gap) + size / 2;
        const icon = this.scene.add.image(-x, 0, textureKey)
            .setOrigin(0.5, 0.5)
            .setDisplaySize(size, size)
            .setInteractive({ useHandCursor: true });
        icon.on('pointerup', callback);
        if (opts?.tooltip) {
            icon.setData('tooltip', opts.tooltip);
            // optional: show tooltip on hover (left as exercise)
        }
        this.iconsContainer.add(icon);
        return icon;
    }

    setReturnCallback(cb: () => void) {
        // find the first text child (the return link) and replace behavior
        const returnText = this.container.list.find(o => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
        if (returnText) {
            returnText.removeAllListeners?.();
            returnText.on('pointerup', cb);
        }
    }

    destroy() {
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.container.destroy(true);
    }
}