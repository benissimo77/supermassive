import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "src/quiz/questions/BaseQuestion";
import { BaseQuestionData } from "src/quiz/questions/QuestionTypes";

import OrderingQuestion from "src/quiz/questions/Ordering";
import NumberQuestion from "src/quiz/questions/Number";

export class QuestionFactory {
    private scene: BaseScene;
    private questionTypes: Map<string, new (scene: BaseScene, data: any) => BaseQuestion>;

    constructor(scene: BaseScene) {
        this.scene = scene;

        // Initialize the map
        // Define the type explicitly for the Map
        this.questionTypes = new Map<string, new (scene: BaseScene, data: any) => BaseQuestion>([
            ['number-closest', NumberQuestion],
            ['number-average', NumberQuestion],
            ['ordering', OrderingQuestion],
            ['matching', OrderingQuestion]
        ]);
    }

    create(type: string, data: BaseQuestionData): BaseQuestion {

        console.log('QuestionFactory::create:', type, data, this.questionTypes);

        // Get the constructor from the map
        const QuestionClass = this.questionTypes.get(type);

        if (QuestionClass) {
            return new QuestionClass(this.scene, data);
        }

        console.error(`Question type not supported: ${type}`);

        return null as unknown as BaseQuestion;
    }
}
