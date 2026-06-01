import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { ImageButton } from "src/ui/ImageButton";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { MatchingQuestionDataV2 as MatchingQuestionData } from "./QuestionTypes";

/**
 * PlayerImageMatchingQuestion
 * Player-side handler for matching questions that have images on the left-side items.
 * Renders 4 ImageButtons in a 2×2 grid alongside 4 text-label dropzones in a second 2×2 grid.
 * Portrait: grids stack vertically. Landscape: grids sit side-by-side.
 * Interaction is identical drag-and-drop to PlayerOrdering.
 */
export default class PlayerImageMatchingQuestion extends PlayerBaseQuestion {

    private buttons: Map<string, ImageButton> = new Map();
    private dropzones: Map<number, Phaser.GameObjects.NineSlice> = new Map();
    private dropzoneLabels: Map<number, Phaser.GameObjects.Text> = new Map();
    private submitButton!: NineSliceButton;
    private items: string[] = [];
    private labels: string[] = [];

    constructor(scene: BaseScene, questionData: MatchingQuestionData) {
        super(scene, questionData);
    }

    protected createAnswerUI(): void {
        console.log('PlayerImageMatchingQuestion::createAnswerUI:', this.questionData);
        try {
            console.log('PlayerImageMatchingQuestion::createAnswerUI (json):', JSON.stringify(this.questionData));
        } catch (e) {
            console.warn('Could not stringify questionData for debug', e);
        }

        // Ensure answer container visible for debugging
        try {
            this.answerContainer.setVisible(true);
            this.answerContainer.setAlpha(1);
        } catch (e) {
            console.warn('Could not set answerContainer visible:', e);
        }

        const questionData = this.questionData as MatchingQuestionData;

        // Prefer leftItemsShuffled / leftItems + rightItems; fallback to legacy pairs
        const q: any = questionData;
        let leftItems = q.leftItemsShuffled || q.leftItems;
        let rightItems = q.rightItems;
        if ((!Array.isArray(leftItems) || !Array.isArray(rightItems))) {
            const pairs = q.pairsShuffled || q.pairs || [];
            leftItems = pairs.map((p: any, i: number) => ({ text: p.left, image: (q.itemImages && q.itemImages[i]) || undefined }));
            rightItems = pairs.map((p: any) => ({ text: p.right }));
        }

        this.items = (leftItems || []).map((li: any) => li && li.text ? li.text : '');
        this.labels = (rightItems || []).map((ri: any) => ri && ri.text ? ri.text : '');

        console.log('PlayerImageMatchingQuestion::computed leftItems length:', (leftItems || []).length, 'rightItems length:', (rightItems || []).length);
        console.log('PlayerImageMatchingQuestion::leftItems sample:', (leftItems || []).slice(0,10));
        console.log('PlayerImageMatchingQuestion::rightItems sample:', (rightItems || []).slice(0,10));

        // Create ImageButtons — use image field from leftItems where available
        const originalLeftItems = leftItems || [];

        this.items.forEach((item, index) => {
            let url: string = originalLeftItems[index] && originalLeftItems[index].image ? originalLeftItems[index].image : '';

            // Guard against non-string values stored in itemImages
            if (url && typeof url === 'object') {
                url = (url as any).url || (url as any).src || (url as any).href || '';
            }
            if (typeof url !== 'string') url = '';

            const button = new ImageButton(this.scene, item, url || null);
            button.setData('index', index);
            button.setData('item', item);
            button.setData('dropzone', null);
            this.buttons.set(item, button);
            this.answerContainer.add(button);
        });

        console.log('PlayerImageMatchingQuestion::createAnswerUI: created', this.items.length, 'image buttons and', this.labels.length, 'labels');

        // If nothing created, add a visible debug marker so it's obvious on-screen
        if (this.items.length === 0 || this.labels.length === 0) {
            const debugText = this.scene.add.text(0, 0, 'No matching items', { fontSize: 36, color: '#ff0000' }).setOrigin(0.5);
            this.answerContainer.add(debugText);
            console.warn('PlayerImageMatchingQuestion: no items/labels to display');
        }

        // Create dropzones with text labels (right side of each pair)
        this.labels.forEach((label, index) => {
            const dropzone = this.scene.add.nineslice(
                0, 0, 'dropzone', undefined, 100, 100, 12, 12, 12, 12
            ).setOrigin(0.5).setTint(0x8080C0);

            dropzone.setData('dropped', '');
            dropzone.setData('index', index);
            this.dropzones.set(index, dropzone);
            this.answerContainer.add(dropzone);

            const labelText = this.scene.add.text(0, 0, label, this.scene.labelConfig).setOrigin(0.5);
            this.dropzoneLabels.set(index, labelText);
            this.answerContainer.add(labelText);
        });

        this.submitButton = new NineSliceButton(this.scene, 'Submit');
        this.answerContainer.add(this.submitButton);
        this.submitButton.setVisible(false);

        if (this.questionData.mode === 'ask') {
            this.makeInteractive();
        }
    }

    protected showAnswerContent(answerHeight: number): void {
        const isPortrait = this.scene.isPortrait();
        const scaleFactor = this.scene.getUIScaleFactor();
        const totalH = this.scene.getY(answerHeight);

        // Square button size that fits a 2×2 grid on either orientation
        const BTNSIZE = 380 * scaleFactor;
        const GAP = 20 * scaleFactor;
        const SECTION_GAP = 40 * scaleFactor;
        const SUBMIT_H = 80 * scaleFactor;
        const SUBMIT_PAD = 20 * scaleFactor;

        if (isPortrait) {
            // Two 2×2 grids stacked vertically, full block vertically centred
            const totalContent = 4 * BTNSIZE + 2 * GAP + SECTION_GAP + SUBMIT_PAD + SUBMIT_H;
            const startY = Math.max(SUBMIT_PAD, (totalH - totalContent) / 2);

            const grid1CenterY = startY + BTNSIZE + GAP / 2;
            const grid2CenterY = grid1CenterY + BTNSIZE + GAP / 2 + SECTION_GAP + BTNSIZE + GAP / 2;
            const submitY = grid2CenterY + BTNSIZE + GAP / 2 + SUBMIT_PAD + SUBMIT_H / 2;

            this.placeButtonGrid(0, grid1CenterY, BTNSIZE, GAP);
            this.placeDropzoneGrid(0, grid2CenterY, BTNSIZE, GAP);

            this.submitButton.setButtonSize(BTNSIZE * 1.5, SUBMIT_H * 0.85);
            this.submitButton.setTextSize(SUBMIT_H * 0.45);
            this.submitButton.setPosition(0, submitY);
        } else {
            // Two 2×2 grids side by side, vertically centred with submit below
            const gridCenterY = (totalH - SUBMIT_H - SUBMIT_PAD * 2) / 2;
            const submitY = totalH - SUBMIT_PAD - SUBMIT_H / 2;

            this.placeButtonGrid(-480, gridCenterY, BTNSIZE, GAP);
            this.placeDropzoneGrid(480, gridCenterY, BTNSIZE, GAP);

            this.submitButton.setButtonSize(BTNSIZE * 1.5, SUBMIT_H * 0.85);
            this.submitButton.setTextSize(SUBMIT_H * 0.45);
            this.submitButton.setPosition(480, submitY);
        }

        this.submitButton.setVisible(false);
    }

    private placeButtonGrid(cx: number, cy: number, btnSize: number, gap: number): void {
        this.buttons.forEach((button) => {
            const index: number = button.getData('index');
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = cx + (col - 0.5) * (btnSize + gap);
            const y = cy + (row - 0.5) * (btnSize + gap);
            button.setButtonSize(btnSize, btnSize);
            button.setPosition(x, y);
            button.setData('OriginX', x);
            button.setData('OriginY', y);
            button.setData('dropzone', null);
        });
    }

    private placeDropzoneGrid(cx: number, cy: number, btnSize: number, gap: number): void {
        this.dropzones.forEach((dropzone, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = cx + (col - 0.5) * (btnSize + gap);
            const y = cy + (row - 0.5) * (btnSize + gap);
            dropzone.setSize(btnSize, btnSize);
            dropzone.setPosition(x, y);
            const label = this.dropzoneLabels.get(index);
            if (label) {
                label.setPosition(x, y);
                label.setFontSize(Math.max(20, btnSize * 0.12));
            }
            dropzone.setData('dropped', '');
            dropzone.setTint(0x8080C0);
        });
    }

    protected makeInteractive(): void {
        this.addSceneInputHandlers();

        this.buttons.forEach((button) => {
            button.setInteractive({ useHandCursor: true, draggable: true });
        });

        this.dropzones.forEach((dropzone) => {
            dropzone.setInteractive({ dropZone: true });
        });

        this.submitButton.on('pointerup', () => this.handleSubmit());
        this.submitButton.setInteractive({ useHandCursor: true });
    }

    protected makeNonInteractive(): void {
        this.removeSceneInputHandlers();
        this.buttons.forEach(button => button.disableInteractive());
        this.dropzones.forEach(dropzone => dropzone.disableInteractive());
        this.submitButton.disableInteractive();
        this.submitButton.removeAllListeners();
    }

    public createRevealAnswerTimeline(): gsap.core.Timeline {
        // Player screen does not self-reveal — host drives the reveal
        return gsap.timeline();
    }

    private handleSubmit(): void {
        this.makeNonInteractive();

        const answers: string[] = [];
        this.dropzones.forEach((dropzone) => {
            answers.push(dropzone.getData('dropped') || '');
        });

        this.submitAnswer(answers);

        const tl = gsap.timeline();
        tl.to(this.answerContainer, {
            y: this.scene.getY(2160),
            duration: 0.5,
            ease: 'back.in'
        });
        tl.add(() => {
            this.scene.soundManager.playFX('submit-answer');
        }, '<+0.25');
        tl.play();
    }

    private checkDropzonesFull(): boolean {
        let full = true;
        this.dropzones.forEach((dropzone) => {
            if (!dropzone.getData('dropped')) full = false;
        });
        return full;
    }

    private addSceneInputHandlers(): void {
        this.scene.input.on('dragstart', this.handleDragStart, this);
        this.scene.input.on('dragend', this.handleDragEnd, this);
        this.scene.input.on('drag', this.handleDrag, this);
        this.scene.input.on('dragenter', this.handleDragEnter, this);
        this.scene.input.on('dragleave', this.handleDragLeave, this);
        this.scene.input.on('drop', this.handleDrop, this);
    }

    private removeSceneInputHandlers(): void {
        this.scene.input.off('dragstart', this.handleDragStart, this);
        this.scene.input.off('drag', this.handleDrag, this);
        this.scene.input.off('dragend', this.handleDragEnd, this);
        this.scene.input.off('dragenter', this.handleDragEnter, this);
        this.scene.input.off('dragleave', this.handleDragLeave, this);
        this.scene.input.off('drop', this.handleDrop, this);
    }

    private handleDragStart(pointer: Phaser.Input.Pointer, gameObject: any): void {
        this.answerContainer.bringToTop(gameObject);

        // Free the dropzone the button was sitting in, if any
        if (gameObject.getData('dropzone') !== null) {
            const dropzoneIndex: number = gameObject.getData('dropzone');
            const dropzone = this.dropzones.get(dropzoneIndex);
            if (dropzone) {
                dropzone.setData('dropped', '');
                dropzone.setTint(0x8080C0);
                gameObject.setData('dropzone', null);
            }
        }
    }

    private handleDragEnd(pointer: Phaser.Input.Pointer, gameObject: any): void {
        // Snap back to origin if not successfully dropped
        if (gameObject.getData('dropzone') === null) {
            this.scene.tweens.add({
                targets: gameObject,
                x: gameObject.getData('OriginX'),
                y: gameObject.getData('OriginY'),
                duration: 300,
                ease: 'Power2',
            });
        }

        this.submitButton.setVisible(this.checkDropzonesFull());
        this.answerContainer.bringToTop(this.submitButton);
    }

    private handleDrag(pointer: Phaser.Input.Pointer, gameObject: any, dragX: number, dragY: number): void {
        gameObject.setPosition(dragX, dragY);
    }

    private handleDragEnter(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        if (!dropzone.getData('dropped')) {
            dropzone.setTint(0x00ff00);
        }
    }

    private handleDragLeave(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        dropzone.setTint(0x8080C0);
    }

    private handleDrop(pointer: Phaser.Input.Pointer, gameObject: any, dropzone: any): void {
        if (!dropzone.getData('dropped')) {
            dropzone.setData('dropped', gameObject.getData('item'));
            gameObject.setData('dropzone', dropzone.getData('index'));

            this.scene.tweens.add({
                targets: gameObject,
                x: dropzone.x,
                y: dropzone.y,
                duration: 300,
                ease: 'Power2',
            });
        }
    }

    public destroy(fromScene?: boolean): void {
        if (this.scene) {
            this.removeSceneInputHandlers();
        }
        super.destroy(fromScene);
    }
}
