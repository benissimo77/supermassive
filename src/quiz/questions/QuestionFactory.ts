import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { BaseQuestionData, MultipleChoiceQuestionData } from "./QuestionTypes";

import MultipleChoiceQuestion from "./MultipleChoice";
import TrueFalseQuestion from "./TrueFalse";
import OrderingQuestion from "./Ordering";
import ImageOrderingQuestion from "./ImageOrdering";
import TextQuestion from "./Text";
import PlayerTextQuestion from "./PlayerText";
import PlayerNumberQuestion from "./PlayerNumber";
import PlayerOrderingQuestion from "./PlayerOrdering";
import PlayerImageOrderingQuestion from "./PlayerImageOrdering";
import PlayerImageMatchingQuestion from "./PlayerImageMatching";
import NumberQuestion from "./Number";
import HotspotQuestion from "./Hotspot";
import DrawQuestion from "./Draw";

export class QuestionFactory {
    private scene: BaseScene;
    private questionTypes: Map<string, any>;

    constructor(scene: BaseScene) {
        this.scene = scene;

        // Initialize the map
        this.questionTypes = new Map<string, any>([
            ['multiple-choice', MultipleChoiceQuestion],
            ['true-false', TrueFalseQuestion],
            ['text', TextQuestion],
            ['number-exact', NumberQuestion],
            ['number-closest', NumberQuestion],
            ['number-average', NumberQuestion],
            ['ordering', OrderingQuestion],
            ['matching', OrderingQuestion],
            ['hotspot', HotspotQuestion],
            ['point-it-out', HotspotQuestion],
            ['draw', DrawQuestion],
        ]);
    }

    create(type: string, data: BaseQuestionData): any {
        console.log(`QuestionFactory.create: type=${type}, scene.TYPE=${this.scene.TYPE}`);

        // --- PILOT MIGRATION INTERCEPT ---
        if (this.scene.TYPE === 'play') {
            if (type === 'text') {
                return new PlayerTextQuestion(this.scene, data as any);
            }
            if (['number-exact', 'number-closest', 'number-average'].includes(type)) {
                return new PlayerNumberQuestion(this.scene, data as any);
            }
            if (type === 'ordering') {
                const hasImages = Array.isArray((data as any).itemImages) &&
                    (data as any).itemImages.some((url: string) => url && url.trim().length > 0);
                if (hasImages) {
                    return new PlayerImageOrderingQuestion(this.scene, data as any);
                }
                return new PlayerOrderingQuestion(this.scene, data as any);
            }
            if (type === 'matching') {
                // Prefer leftItemsShuffled/leftItems image fields for matching questions
                const q: any = data;
                let leftItems = q.leftItemsShuffled || q.leftItems;
                if (!Array.isArray(leftItems) && Array.isArray(q.pairs)) {
                    leftItems = q.pairs.map((p: any, i: number) => ({ text: p.left, image: (q.itemImages && q.itemImages[i]) || undefined }));
                }
                const hasLeftImages = Array.isArray(leftItems) && leftItems.some((li: any) => li && li.image && String(li.image).trim().length > 0);
                if (hasLeftImages) {
                    return new PlayerImageMatchingQuestion(this.scene, data as any);
                }
                return new PlayerOrderingQuestion(this.scene, data as any);
            }
        }

        // Get the constructor from the map
        let QuestionClass = this.questionTypes.get(type);

        // If it's an ordering or matching question and it has populated images, promote it to ImageOrdering
        if (type === 'ordering' || type === 'matching') {
            const q: any = data;
            let hasImages = false;
            if (type === 'ordering') {
                hasImages = Array.isArray(q.itemImages) && q.itemImages.some((url: string) => url && String(url).trim().length > 0);
            } else {
                // matching - check leftItemsShuffled / leftItems image fields, fallback to pairs/itemImages
                let leftItems = q.leftItemsShuffled || q.leftItems;
                if (!Array.isArray(leftItems) && Array.isArray(q.pairs)) {
                    leftItems = q.pairs.map((p: any, i: number) => ({ text: p.left, image: (q.itemImages && q.itemImages[i]) || undefined }));
                }
                hasImages = Array.isArray(leftItems) && leftItems.some((li: any) => li && li.image && String(li.image).trim().length > 0);
            }
            QuestionClass = hasImages ? ImageOrderingQuestion : OrderingQuestion;
        }

        if (QuestionClass) {
            return new QuestionClass(this.scene, data);
        }

        console.error(`Question type not supported: ${type}`);

        // Return a fallback question
        return new MultipleChoiceQuestion(this.scene, {
            ...data,
            type: 'multiple-choice',
            options: ['Error: Unknown question type']
        } as MultipleChoiceQuestionData);
    }
}
