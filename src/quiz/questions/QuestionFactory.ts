import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { BaseQuestionData, MatchingQuestionData, MultipleChoiceQuestionData } from "./QuestionTypes";

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
                return new PlayerOrderingQuestion(this.scene, data as any);
            }
            if (type === 'matching') {
                const matchingData = data as MatchingQuestionData;
                const hasImages = matchingData.pairImagesShuffled?.some((url: string) => url.trim().length > 0);
                if (hasImages) {
                    return new PlayerImageMatchingQuestion(this.scene, matchingData);
                }
                return new PlayerOrderingQuestion(this.scene, data as any);
            }
        }

        // Get the constructor from the map
        let QuestionClass = this.questionTypes.get(type);

        // If it's an ordering question and it has populated images, promote it to ImageOrdering
        if (type === 'ordering') {
            const hasImages = data.itemImages && data.itemImages.length > 0 && data.itemImages.some((url: string) => url.trim().length > 0);
            if (hasImages) {
                QuestionClass = ImageOrderingQuestion;
            } else {
                QuestionClass = OrderingQuestion;
            }
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
