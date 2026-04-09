import { gsap } from "gsap";
import { BaseScene } from 'src/BaseScene';
import { BaseQuestion } from './BaseQuestion';
import { ImageButton } from 'src/ui/ImageButton';
import { ImageLoader } from 'src/utils/ImageLoader';
import { OrderMatchQuestionData } from './QuestionTypes';

export default class ImageOrderingQuestion extends BaseQuestion {

    // Only used for Host image grid
    protected imageButtonsArray: ImageButton[] = [];
    protected items: string[] = [];

    constructor(scene: BaseScene, data: OrderMatchQuestionData) {
        super(scene, data);

        this.questionData = data as OrderMatchQuestionData;
    }

    protected async createAnswerUI(): Promise<void> {
        console.log('ImageOrdering::createAnswerUI (Host Mode)');
        
        // Extract items
        if (this.questionData.type === 'ordering') {
            this.items = this.questionData.itemsShuffled || [];
        } else {
            const pairs = this.questionData.pairsShuffled || this.questionData.pairs || [];
            this.items = pairs.map((pair: any) => pair.left);
        }

        // Create buttons and allow ImageButton to handle its own loading completely!
        this.items.forEach((item: string, index: number) => {
            const originalIndex = this.questionData.items?.indexOf(item) ?? -1;
            let url = (originalIndex >= 0 && this.questionData.itemImages) ? this.questionData.itemImages[originalIndex] : '';
            
            // Protection against malformed JSON structs if itemImages happens to contain objects instead of strings
            if (url && typeof url === 'object') {
                url = (url as any).url || (url as any).src || (url as any).href || '';
            }
            if (typeof url !== 'string') {
                url = '';
            }

            const button = new ImageButton(this.scene, item, url);
            
            this.imageButtonsArray.push(button);
            this.answerContainer.add(button);
        });

        // Skip adding dropzones for Host Image Grid until the design for revealing answers is settled
    }

    protected showAnswerContent(answerHeight: number): void {
        const scaleFactor = this.scene.getUIScaleFactor();
        
        // Host Layout: Grid of Images
        const buttonWidth = 360 * scaleFactor;
        const buttonHeight = 360 * scaleFactor;
        const padding = 40 * scaleFactor;
        
        const cols = this.imageButtonsArray.length > 2 ? 2 : this.imageButtonsArray.length;
        const rows = Math.ceil(this.imageButtonsArray.length / cols);

        // Calculate block bounds
        const totalWidth = (cols * buttonWidth) + ((cols - 1) * padding);
        const totalHeight = (rows * buttonHeight) + ((rows - 1) * padding);
        
        // Scale container to fit available height gracefully
        const availableHeight = this.scene.getY(1080) - this.answerContainer.y - padding;
        if (availableHeight > 0) {
            const fitScale = availableHeight / totalHeight;
            this.answerContainer.setScale(fitScale);
        } else {
            this.answerContainer.setScale(1);
        }
        
        // X = 0 is center width for the container
        const offsetX = -totalWidth / 2;
        // Y = Top edge below question text
        const topY = padding / 2;

        for (let i = 0; i < this.imageButtonsArray.length; i++) {
            const ib = this.imageButtonsArray[i];
            ib.setButtonSize(buttonWidth, buttonHeight);

            const col = i % cols;
            const row = Math.floor(i / cols);

            // center offsets
            const x = offsetX + (col * (buttonWidth + padding)) + (buttonWidth / 2);
            const y = topY + (row * (buttonHeight + padding)) + (buttonHeight / 2);

            ib.setPosition(x, y);
        }
    }

    public createRevealAnswerTimeline(): gsap.core.Timeline {
        // Simple default animation timeline for Host grid to validate the Base class hook
        // We will build out a specific grid reveal later if it differs from the text list
        const tl = gsap.timeline();
        tl.pause();
        return tl;
    }

    public destroy(): void {
        for (const btn of this.imageButtonsArray) {
            if (btn) btn.destroy();
        }
        super.destroy();
    }
}