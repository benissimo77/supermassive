import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";

import MultipleChoiceQuestion from "./MultipleChoice";
import TrueFalseQuestion from "./TrueFalse";
import OrderingQuestion from "./Ordering";
import TextQuestion from "./Text";
import NumberQuestion from "./Number";
import HotspotQuestion from "./Hotspot";

// import PointItOutQuestion from "./QuestionPointItOut";
// import DrawQuestion from "./QuestionDraw";

export class QuestionFactory {
    private scene: BaseScene;
    private questionTypes: Map<string, new (scene: BaseScene, data: any) => BaseQuestion>;

    constructor(scene: BaseScene) {
        this.scene = scene;

        // Initialize the map
        // Define the type explicitly for the Map
        this.questionTypes = new Map<string, new (scene: BaseScene, data: any) => BaseQuestion>([
            ['multiple-choice', MultipleChoiceQuestion],
            ['true-false', TrueFalseQuestion],
            ['text', TextQuestion],
            ['number-exact', NumberQuestion],
            ['number-closest', NumberQuestion],
            ['ordering', OrderingQuestion],
            ['matching', OrderingQuestion],
            ['hotspot', HotspotQuestion],
            ['point-it-out', HotspotQuestion],
        ]);
    }

    create(type: string, data: any): BaseQuestion {

        // Get the constructor from the map
        const QuestionClass = this.questionTypes.get(type);

        if (QuestionClass) {
            return new QuestionClass(this.scene, data);
        }

        console.error(`Question type not supported: ${type}`);

        // Return a fallback question
        return new MultipleChoiceQuestion(this.scene, {
            ...data,
            options: ['Error: Unknown question type']
        });
    }
}
