import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { ImageButton } from "src/ui/ImageButton";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { MatchingQuestionDataV2 as MatchingQuestionData } from "./QuestionTypes";

/**
 * PlayerImageMatchingQuestion
 * Player-side handler for matching questions that have images on the left-side items.
 * Same column layout as PlayerOrderingQuestion (items in one column, dropzones in a second),
 * except items are square ImageButtons instead of rectangular text buttons.
 * Interaction is identical drag-and-drop to PlayerOrdering.
 */
export default class PlayerImageMatchingQuestion extends PlayerBaseQuestion {

    private buttons: Map<string, ImageButton> = new Map();
    private dropzones: Map<number, Phaser.GameObjects.NineSlice> = new Map();
    private dropzoneLabels: Map<number, Phaser.GameObjects.Text> = new Map();
    private submitButton!: NineSliceButton;
    private items: string[] = [];
    private labels: string[] = [];

    // Square items - laid out as two groups (items | dropzones), items | dropzones side-by-side
    // as columns in portrait, or items-above-dropzones as rows in landscape. Landscape has much
    // less relative vertical room (world-height is capped by screen width there) but the full
    // 1920-wide canvas to spare horizontally, so a row layout (only 2 "ranks" tall - one item
    // row, one dropzone row) lets items go much bigger than the column layout's up-to-4-rows
    // would allow. Unlike small text rectangles, a fixed size here is exposed to real
    // device-aspect-ratio variance (e.g. an iPad's ~4:3 landscape shape vs an iPhone's elongated
    // one), so instead of a final fixed size, ITEM_SIZE is a *reference* size for a
    // nicely-proportioned mockup - the whole answerContainer is then scaled uniformly to fit
    // whatever space is actually available (see showAnswerContent).
    private readonly ITEM_SIZE = 720;
    private readonly GROUP_GAP_RATIO = 1 / 3;    // gap between the item group and dropzone group, as a fraction of item size
    private readonly ITEM_GAP_RATIO = 0.15;      // gap between adjacent items within the same row/column, as a fraction of item size
    private readonly WIDTH_FRACTION = 0.85;      // fraction of canvas width the whole block may use
    private readonly HEIGHT_FRACTION = 0.85;     // fraction of available height the whole block may use

    private readonly SUBMIT_WIDTH_PX = 120;
    private readonly SUBMIT_HEIGHT_PX = 32;
    private readonly SUBMIT_MARGIN_PX = 12;

    constructor(scene: BaseScene, questionData: MatchingQuestionData) {
        super(scene, questionData);
    }

    protected createAnswerUI(): void {
        console.log('PlayerImageMatchingQuestion::createAnswerUI:', this.questionData);

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

        // Create ImageButtons — use image field from leftItems where available
        const originalLeftItems = leftItems || [];

        this.items.forEach((item, index) => {
            let url: string = originalLeftItems[index] && originalLeftItems[index].image ? originalLeftItems[index].image : '';

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
        this.add(this.submitButton);
        this.submitButton.setVisible(false);

        if (this.questionData.mode === 'ask') {
            this.makeInteractive();
        }
    }

    protected showAnswerContent(answerHeight: number): void {
        const physicalScale = this.scene.getPhysicalScale();
        const N = this.items.length;

        // --- Submit button: fixed physical size, pinned to the bottom-right corner - persistent
        // chrome, not part of the scaled content block below (same pattern as PlayerOrdering).
        const submitW = this.SUBMIT_WIDTH_PX * physicalScale;
        const submitH = this.SUBMIT_HEIGHT_PX * physicalScale;
        this.submitButton.setButtonSize(submitW, submitH);
        this.submitButton.adjustTextSize(submitH);
        this.submitButton.setPosition(
            1920 - (this.SUBMIT_WIDTH_PX / 2 + this.SUBMIT_MARGIN_PX) * physicalScale,
            this.scene.getY(answerHeight) - (this.SUBMIT_HEIGHT_PX / 2 + this.SUBMIT_MARGIN_PX) * physicalScale
        );

        // --- Items + dropzones: assembled at a nicely-proportioned reference size - portrait
        // stacks items/dropzones as two side-by-side columns, landscape lays them out as two
        // rows (items above, dropzones below), matching whichever axis has more room to spare
        // (see ITEM_SIZE's comment). Either way the whole answerContainer is then scaled
        // uniformly to fit the available space.
        const isPortrait = this.scene.isPortrait();
        const itemSize = this.ITEM_SIZE;
        const groupGap = itemSize * this.GROUP_GAP_RATIO;
        const itemGap = itemSize * this.ITEM_GAP_RATIO;

        const contentWidth = isPortrait
            ? 2 * itemSize + groupGap
            : N * itemSize + (N - 1) * itemGap;
        const contentHeight = isPortrait
            ? N * itemSize + (N - 1) * itemGap
            : 2 * itemSize + groupGap;

        const availableWidth = 1920 * this.WIDTH_FRACTION;
        const availableHeight = this.scene.getY(answerHeight) * this.HEIGHT_FRACTION;
        const fitScale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);

        this.answerContainer.setScale(fitScale);

        const dropzoneLabelFontSize = Math.max(20, itemSize * 0.15);

        // Children are positioned in plain reference units - answerContainer's scale above
        // handles converting everything to the right on-screen size in one step. itemPos gives
        // the position along the "spread" axis (down a column in portrait, across a row in
        // landscape); groupOffset moves a whole group to its side of the group gap.
        const spread = isPortrait ? contentHeight : contentWidth;
        const itemPos = (index: number): number => -spread / 2 + index * (itemSize + itemGap) + itemSize / 2;
        const groupOffset = (itemSize + groupGap) / 2;

        this.buttons.forEach((button) => {
            const index = button.getData('index');
            const x = isPortrait ? -groupOffset : itemPos(index);
            const y = isPortrait ? itemPos(index) : -groupOffset;

            button.setButtonSize(itemSize, itemSize);
            button.setPosition(x, y);
            button.setData('OriginX', x);
            button.setData('OriginY', y);
            button.setData('dropzone', null);
        });

        this.dropzones.forEach((dropzone, index) => {
            const x = isPortrait ? groupOffset : itemPos(index);
            const y = isPortrait ? itemPos(index) : groupOffset;

            dropzone.setSize(itemSize, itemSize);
            dropzone.setPosition(x, y);

            const label = this.dropzoneLabels.get(index);
            if (label) {
                label.setPosition(x, y);
                label.setFontSize(dropzoneLabelFontSize);
            }

            dropzone.setData('dropped', '');
            dropzone.setTint(0x8080C0);
        });

        this.submitButton.setVisible(false);
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
        this.bringToTop(this.submitButton);
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
