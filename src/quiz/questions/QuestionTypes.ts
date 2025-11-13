// Base type for all questions (shared fields)
export interface BaseQuestionData {
    id?: string;
    questionNumber: number;
    type: string;
    text?: string;
    image?: string;
    audio?: string;
    video?: string;
    mode: 'ask' | 'answer';
    
    // Optional fields (present when mode='answer')
    answer?: any;  // Each question type defines specific shape
    results?: Record<string, any>;
}

// MULTIPLE CHOICE
export interface MultipleChoiceQuestionData extends BaseQuestionData {
    type: 'multiple-choice';
    options: string[];
    answer?: string;  // Only present when mode='answer'
}

// TRUE-FALSE
export interface TrueFalseQuestionData extends BaseQuestionData {
    type: 'true-false';
    answer?: boolean;  // Only present when mode='answer'
}

// MATCHING
export interface MatchingQuestionData extends BaseQuestionData {
    type: 'matching';
    pairs: { left: string; right: string }[];
    answer?: number[];  // Array of indices, only when mode='answer'
}

// ORDERING
export interface OrderingQuestionData extends BaseQuestionData {
    type: 'ordering';
    items: string[];
    extra: { startLabel:string; endLabel:string };
    answer?: number[];  // Array of indices, only when mode='answer'
}

// COMBINED ORDERING/MATCHING SINCE QUESTION CLASS HANDLES BOTH
export type OrderMatchQuestionData =
    | MatchingQuestionData
    | OrderingQuestionData;


// NUMBER
export interface NumberQuestionData extends BaseQuestionData {
    type: 'number-closest' | 'number-exact';
    answer?: number;
}

// TEXT
export interface TextQuestionData extends BaseQuestionData {
    type: 'text';
    answer?: string;
}

// HOTSPOT
export interface HotspotQuestionData extends BaseQuestionData {
    type: 'hotspot';
    image: string;  // Required for hotspot
    answer?: {
        x: number;
        y: number;
    };
    results?: Record<string, HotspotResultData>;
}

export interface HotspotResultData {
    x: number;
    y: number;
}

// POINT-IT-OUT
export interface PointItOutQuestionData extends BaseQuestionData {
    type: 'point-it-out';
    image: string;  // Required for point-it-out
    answer?: {
        start: { x: number; y: number };
        end: { x: number; y: number };
    };
    results?: Record<string, PointItOutResultData>;
}

export interface PointItOutResultData {
    start: { x: number; y: number };
    end: { x: number; y: number };
}

// Union type for all question types
export type QuestionData =
    | TrueFalseQuestionData
    | MultipleChoiceQuestionData
    | MatchingQuestionData
    | HotspotQuestionData
    | PointItOutQuestionData;
    