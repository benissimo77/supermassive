import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the master quiz schema dynamically
const schemaPath = path.join(__dirname, 'quiz-schema.json');
const quizSchemaFile = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Extract enums from the master schema to keep AI in sync
const ROUND_TIMER_ENUM = quizSchemaFile.definitions.round.properties.roundTimer.enum;
const SHOW_ANSWER_ENUM = quizSchemaFile.definitions.round.properties.showAnswer.enum;
const UPDATE_SCORES_ENUM = quizSchemaFile.definitions.round.properties.updateScores.enum;
const QUESTION_TYPE_ENUM = quizSchemaFile.definitions.question.properties.type.enum;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are a professional Quiz Master for a high-end television game show like "The Chase" or "Who Wants to Be a Millionaire?". 
Your goal is to create a quiz that is engaging, challenging, and 100% factually accurate.

### TECHNICAL SPECIFICATION:
Your output MUST strictly adhere to the following JSON Schema. Pay close attention to required fields for each question type:
${JSON.stringify(quizSchemaFile, null, 2)}

### STRUCTURE & DEFAULTS:
- Unless specified otherwise, generate **3 rounds** with **5-8 questions** per round.
- **Round Settings:** 
    - "roundTimer": Default to "0" (no timer).
    - "showAnswer": Default to "round" (show answer after each round).
    - "updateScores": Default to "round" (update scores after each round).

### FACTUAL INTEGRITY & SANITY CHECKS:
- CRITICAL: Every fact must be true. Double-check numbers, dates, and names.
- SANITY CHECK: If a question asks for a count (e.g., "How many bicycles in the world?"), ensure the answer is realistic (e.g., "over 1 billion", not "1").
- If you are not 100% certain of a fact, DO NOT use it. Choose a different topic.
- Use the "reasoning" field to briefly state the source or logic for the answer to help verify it.

### QUALITY & DIFFICULTY:
1. **NO TRIVIAL QUESTIONS:** Avoid "What is the capital of France?" or "How many legs does a spider have?".
2. **DIFFICULTY CURVE:** Within each round, start with 2 "Easy" questions, move to "Medium", and end with 1-2 "Hard" or "Expert" questions.
3. **DIVERSITY:** Mix history, pop culture, science, geography, and "odd one out" style questions.
4. **ENGAGEMENT:** Use interesting facts. Instead of "When was the Great Fire of London?", try "In which bakery on Pudding Lane did the Great Fire of London begin in 1666?".
5. **NO REPETITION:** Ensure each question in a round is distinct in topic and style.

### IMAGE HANDLING & VISUALS:
- DO NOT provide image URLs. Provide a "searchQuery" and a "imageDescription".
- **Hotspot / Point-it-out:** These require a "busy" image. Describe a scene with many elements (e.g., "A 16th-century map of the world with many sea monsters and ships").
- CRITICAL: The image and search query MUST NOT give away the answer. 

### QUESTION TYPES & REQUIRED FIELDS:
- **multiple-choice:** 
    - "options": Array of 4 strings. 
    - CRITICAL: The FIRST item (index 0) MUST be the correct answer. The other 3 must be plausible but incorrect.
    - the quiz system will randomise the options when displaying to users, it remembers the FIRST item so it knows the correct answer
- **true-false:** 
    - "answer": String "true" or "false".
- **text:** 
    - CRITICAL: Only use this for answers that are short, unambiguous, and have a single definitive spelling (e.g., "COLDPLAY", "FRANCE", "EIFFEL TOWER"). 
    - DO NOT use for descriptive answers, names that could easily be mis-spelt or anything where the player might type a synonym.
    - "answer": String (short, unambiguous).
- **number-exact / number-closest:** 
    - "answer": Number.
- **number-average:**
    - CRITICAL: this question does NOT mean "answer must be an average of some values" - it means "the average of all player answers will be calculated, players closest to this average score the points"
    - Therefore this question type is for questions that might not even have an answer but instead rely on an opinion (can you guess what your fellow teams will think?)
    - Examples: "On a scale of 1-100, how spicy is a jalapeno pepper?", "How many pizzas are eaten in the USA every year?".
    - "answer": Not necessary since the answer is based on player's answers, although if there IS an actual answer then provide it for information
- **ordering:** 
    - This question requires players to arrange items in order, e.g. chronological, size, popularity etc.
    - "items": Array of 3-6 strings arranged in the CORRECT order.
    - "extra": Labels to denote the scale that items are arranged along eg { "startLabel": "Earliest", "endLabel": "Latest" } or { "startLabel": "Smallest", "endLabel": "Largest" }.
- **matching:** 
    - This question requires players to match pairs of related items.
    - "pairs": Array of 3-6 pairs of items: { "left": "item A", "right": "match A" }.
- hotspot / point-it-out:
    - "answer": null (The user will set the exact point in the editor).

### QUESTION TYPE DISTRIBUTION:
Unless specified otherwise, aim for a healthy mix:
- 40% Multiple Choice (The bread and butter)
- 30% Text / Number (For definitive facts)
- 20% Ordering / Matching (For deeper engagement)
- 10% True/False / Visual


### NEGATIVE CONSTRAINTS:
- No repetitive questions.
- No ambiguous answers.
- No "hallucinated" or nonsensical facts.
- Avoid US-centric questions unless asked explicitly in the user prompt
`;

const QUIZ_SCHEMA = {
    name: "quiz_generation",
    strict: true,
    schema: {
        type: "object",
        properties: {
            title: { type: "string" },
            description: { type: "string" },
            rounds: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        roundTimer: { type: "string", enum: ROUND_TIMER_ENUM },
                        showAnswer: { type: "string", enum: SHOW_ANSWER_ENUM },
                        updateScores: { type: "string", enum: UPDATE_SCORES_ENUM },
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { 
                                        type: "string", 
                                        enum: QUESTION_TYPE_ENUM 
                                    },
                                    text: { type: "string" },
                                    options: { 
                                        type: "array", 
                                        items: { type: "string" },
                                        description: "For multiple-choice, first item is correct. Otherwise empty array."
                                    },
                                    answer: { 
                                        type: ["string", "number", "null"],
                                        description: "The correct answer. For hotspot/point-it-out, use null."
                                    },
                                    searchQuery: { type: "string" },
                                    imageDescription: { type: "string" },
                                    reasoning: { type: "string" },
                                    items: { 
                                        type: "array", 
                                        items: { type: "string" },
                                        description: "For ordering questions. Otherwise empty array."
                                    },
                                    extra: {
                                        type: "object",
                                        properties: {
                                            startLabel: { type: "string" },
                                            endLabel: { type: "string" }
                                        },
                                        required: ["startLabel", "endLabel"],
                                        additionalProperties: false,
                                        description: "For ordering questions. Use empty strings if not applicable."
                                    },
                                    pairs: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                left: { type: "string" },
                                                right: { type: "string" }
                                            },
                                            required: ["left", "right"],
                                            additionalProperties: false
                                        },
                                        description: "For matching questions. Otherwise empty array."
                                    }
                                },
                                required: [
                                    "type", "text", "options", "answer", "searchQuery", 
                                    "imageDescription", "reasoning", "items", "extra", "pairs"
                                ],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ["title", "description", "roundTimer", "showAnswer", "updateScores", "questions"],
                    additionalProperties: false
                }
            }
        },
        required: ["title", "description", "rounds"],
        additionalProperties: false
    }
};

const AUDIT_SCHEMA = {
    name: "quiz_audit",
    strict: true,
    schema: {
        type: "object",
        properties: {
            corrections: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        roundIndex: { type: "number" },
                        questionIndex: { type: "number" },
                        action: { type: "string", enum: ["update", "remove", "warn"] },
                        verification: { 
                            type: "string", 
                            description: "Step-by-step verification of the facts in this question. Prove why it is correct or incorrect." 
                        },
                        reason: { type: "string" },
                        updatedQuestion: { 
                            anyOf: [
                                {
                                    type: "object",
                                    properties: {
                                        type: { type: "string", enum: QUESTION_TYPE_ENUM },
                                        text: { type: "string" },
                                        options: { type: "array", items: { type: "string" } },
                                        answer: { type: ["string", "number", "null"] },
                                        searchQuery: { type: "string" },
                                        imageDescription: { type: "string" },
                                        reasoning: { type: "string" },
                                        items: { type: "array", items: { type: "string" } },
                                        extra: {
                                            type: "object",
                                            properties: {
                                                startLabel: { type: "string" },
                                                endLabel: { type: "string" }
                                            },
                                            required: ["startLabel", "endLabel"],
                                            additionalProperties: false
                                        },
                                        pairs: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    left: { type: "string" },
                                                    right: { type: "string" }
                                                },
                                                required: ["left", "right"],
                                                additionalProperties: false
                                            }
                                        }
                                    },
                                    required: [
                                        "type", "text", "options", "answer", "searchQuery", 
                                        "imageDescription", "reasoning", "items", "extra", "pairs"
                                    ],
                                    additionalProperties: false
                                },
                                { type: "null" }
                            ],
                            description: "The full corrected question object. Only required if action is 'update'."
                        }
                    },
                    required: ["roundIndex", "questionIndex", "action", "verification", "reason", "updatedQuestion"],
                    additionalProperties: false
                }
            }
        },
        required: ["corrections"],
        additionalProperties: false
    }
};

export async function generateQuizFromAI(userPrompt, existingQuiz = null) {
    console.log('generateQuizFromAI called with prompt:', userPrompt);
    if (existingQuiz) {
        console.log('Existing quiz received:', !!existingQuiz, 'Rounds:', existingQuiz.rounds?.length);
    }
    
    // Fallback for development if API key is missing or for testing UI
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('your-')) {
        console.warn("OpenAI API Key missing or invalid. Returning mock data.");
        return getMockQuiz(userPrompt);
    }

    try {
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Generate quiz content based on this request: ${userPrompt}. 
            
            CONTEXT: The user is in a quiz editor. 
            - If they ask to "add a round", generate exactly one round. 
            - If they don't specify counts, default to 1 round of 5 questions. 
            - Always follow specific counts mentioned in their prompt (e.g. "3 questions" or "2 rounds") over the defaults.
            - IMPORTANT: Generate 2 EXTRA questions per round as "spares". These will be used to filter out any low-quality or trivially easy questions.` }
        ];

        if (existingQuiz && (existingQuiz.rounds?.length > 0 || existingQuiz.title)) {
            messages.push({
                role: "assistant",
                content: `The current quiz structure is:
Title: ${existingQuiz.title}
Description: ${existingQuiz.description}
Rounds: ${existingQuiz.rounds?.map(r => `"${r.title}" (${r.questions?.length || 0} questions)`).join(', ')}

Please ensure your new content COMPLEMENTS this existing data. 
- If the user asks for new rounds, ensure they don't duplicate existing ones.
- If the user asks for more questions, you can return a round with the SAME TITLE as an existing one, and I will merge the new questions into it.`
            });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Switched to mini: 20x cheaper and faster
            messages: messages,
            response_format: { 
                type: "json_schema",
                json_schema: QUIZ_SCHEMA
            }
        });

        const newContent = JSON.parse(response.choices[0].message.content);

        // --- DOUBLE-CHECK PIPELINE ---
        const validationResult = await validateQuizWithAI(newContent, { hasSpares: true });
        const { corrections } = validationResult;
        
        // Apply corrections in reverse order to avoid index shifting if we remove items
        const toRemove = [];
        
        corrections.forEach(correction => {
            const { roundIndex, questionIndex, action, updatedQuestion, reason } = correction;
            if (newContent.rounds[roundIndex] && newContent.rounds[roundIndex].questions[questionIndex]) {
                const question = newContent.rounds[roundIndex].questions[questionIndex];
                
                if (action === 'update' && updatedQuestion) {
                    console.log(`AI Fact-Check: Updating question ${questionIndex} in round ${roundIndex}`);
                    newContent.rounds[roundIndex].questions[questionIndex] = updatedQuestion;
                } else if (action === 'remove') {
                    console.log(`AI Fact-Check: Flagging question ${questionIndex} in round ${roundIndex} for removal: ${reason}`);
                    toRemove.push({ roundIndex, questionIndex });
                } else if (action === 'warn') {
                    console.log(`AI Fact-Check: Adding warning to question ${questionIndex} in round ${roundIndex}: ${reason}`);
                    question.warning = reason;
                }
            }
        });

        // Remove flagged questions
        toRemove.sort((a, b) => b.questionIndex - a.questionIndex).forEach(item => {
            newContent.rounds[item.roundIndex].questions.splice(item.questionIndex, 1);
        });

        // Post-process to ensure schema compliance and add heuristic warnings
        if (newContent.rounds) {
            newContent.rounds.forEach(round => {
                if (!round.roundTimer) round.roundTimer = "0";
                if (!round.showAnswer) round.showAnswer = "round";
                if (!round.updateScores) round.updateScores = "round";
                if (!round.questions) round.questions = [];

                round.questions.forEach(question => {
                    if (!question.options) question.options = [];
                    if (question.answer === undefined) question.answer = null;
                    if (!question.searchQuery) question.searchQuery = "";
                    if (!question.imageDescription) question.imageDescription = "";
                    if (!question.reasoning) question.reasoning = "";
                    if (!question.items) question.items = [];
                    if (!question.extra) {
                        question.extra = { startLabel: "", endLabel: "" };
                    }
                    if (!question.pairs) question.pairs = [];
                    
                    if (question.type === 'multiple-choice' && question.options.length > 0 && !question.answer) {
                        question.answer = question.options[0];
                    }
                });
            });
        }

        // --- MERGE LOGIC ---
        let mergedQuiz = null;
        if (existingQuiz) {
            mergedQuiz = JSON.parse(JSON.stringify(existingQuiz));
            if (!mergedQuiz.rounds) mergedQuiz.rounds = [];

            if (newContent.rounds) {
                newContent.rounds.forEach(newRound => {
                    const existingRound = mergedQuiz.rounds.find(r => 
                        r.title && newRound.title && r.title.trim().toLowerCase() === newRound.title.trim().toLowerCase()
                    );

                    if (existingRound) {
                        if (!existingRound.questions) existingRound.questions = [];
                        if (newRound.questions) {
                            existingRound.questions.push(...newRound.questions);
                        }
                    } else {
                        mergedQuiz.rounds.push(newRound);
                    }
                });
            }
        }
        
        // Final quiz data to return
        const finalQuiz = !existingQuiz ? newContent : mergedQuiz;

        // --- ATTACH VALIDATION INFO ---
        // We need to re-validate the merged final quiz structure to provide accurate path-based messages
        const finalValidation = await validateQuizWithAI(finalQuiz);
        
        // Convert paths for the frontend - since this is a new generation, we want the warnings to show
        finalQuiz.validation = finalValidation.errors || [];
        
        // Also manually inject warning text into question objects for the ⚠️ icon logic in dashboard-quizedit-v2.js
        finalValidation.errors.forEach(err => {
            const path = err.instancePath.split('/');
            if (path[1] === 'rounds' && path[3] === 'questions') {
                const rIdx = parseInt(path[2]);
                const qIdx = parseInt(path[4]);
                if (finalQuiz.rounds[rIdx] && finalQuiz.rounds[rIdx].questions[qIdx]) {
                    finalQuiz.rounds[rIdx].questions[qIdx].warning = err.message;
                }
            }
        });
        
        return finalQuiz;
    } catch (error) {
        console.error('Error merging quiz data:', error);
        throw error;
    }
}

/**
 * Performs a second pass on the generated quiz to fact-check and validate questions.
 * This can be used for any quiz, whether AI-generated or manually created.
 */
export async function validateQuizWithAI(quizData, options = {}) {
    const { hasSpares = false } = options;
    console.log('AI Fact-Check: Starting validation pass...');
    
    const validationPrompt = `
    You are a professional Fact-Checking Editor for a high-stakes television trivia show like "The Chase" or "Who Wants to Be a Millionaire?". 
    Your goal is to ensure 100% factual accuracy and high quality. We cannot afford to have a wrong answer in a live game.

    ### MISSION:
    Review the following quiz data for errors. Be strict, skeptical, and thorough.

    ### CRITICAL RULES:
    1. FACTUAL ACCURACY: Every question and answer must be 100% correct. If a date, name, or fact is wrong, you MUST fix it.
    2. MULTIPLE-CHOICE: The first option (index 0) MUST be the correct answer. The "answer" field must also match this first option.
    3. ORDERING: The "items" array MUST be provided in the CORRECT sequence.
    4. MATCHING: The "pairs" array MUST contain correct matches (left matched to right).
    5. COORDINATE BLINDNESS: For 'hotspot' and 'point-it-out', you cannot see the image. Do NOT attempt to 'fix' numerical coordinates (the "answer" field for these types). Focus only on whether the 'imageDescription' and 'text' create a logical, solvable task.
    6. VISUAL CONSISTENCY: For questions that refer to an image (e.g., "Who is this?"), verify that the 'imageDescription' matches the 'answer'. If the description is of "Tom Hancock" but the answer is "Tom Cruise", fix the inconsistency.
    7. TAUTOLOGY: Remove questions that contain the answer (e.g. "In which country is the French Riviera?"). Action='remove'.
    8. AMBIGUITY: If a 'text' question has an answer that is too long or easily mis-spelt, change it to 'multiple-choice' with plausible distractors.
    9. QUALITY: Identify questions that are too easy, poorly phrased, or boring. Use action='warn' or 'remove' depending on severity.
    
    ### VERIFICATION PROCESS:
    For EVERY question, you must:
    1. Independently verify the facts. Do not assume the provided answer is correct.
    2. Check if the distractors (wrong options) are actually wrong.
    3. Only suggest an 'update' if you can improve the factual accuracy or technical structure.
    4. If the question is already 100% perfect, DO NOT include it in your output.

    SPARES/FILTERING:
    ${hasSpares ? "You have been provided with extra questions per round. Be ruthless and 'remove' any question that isn't excellent." : "This is an existing quiz. Only 'remove' if the question is unfixable or completely factually wrong. Prefer 'update' or 'warn' for fixable issues."}

    OUTPUT:
    Return an array of 'corrections'. 
    - action: 'update', 'remove', or 'warn'.
    - verification: Describe your verification steps (e.g., "I checked the date of the Titanic sinking; it was April 15, 1912. The provided answer was correct.").
    - reason: Explain exactly what was wrong if you are updating/removing.
    - updatedQuestion: The FULL question object with your fixes (null if not updating).
    `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Upgraded to gpt-4o for superior fact-checking and reasoning
            messages: [
                { role: "system", content: "You are a strict fact-checking editor. You take pride in catching errors that others miss. Always output valid JSON." },
                { role: "user", content: `${validationPrompt}\n\nQUIZ DATA:\n${JSON.stringify(quizData)}` }
            ],
            response_format: { 
                type: "json_schema", 
                json_schema: AUDIT_SCHEMA 
            }
        });

        const result = JSON.parse(response.choices[0].message.content);
        const corrections = result.corrections || [];
        
        console.log(`AI Fact-Check: Found ${corrections.length} potential issues.`);
        
        corrections.forEach(c => {
            console.log(`- Question [${c.roundIndex}:${c.questionIndex}] (${c.action.toUpperCase()}): ${c.reason}`);
            console.log(`  Verification: ${c.verification}`);
        });

        // Map corrections to the frontend validation format (AJV style)
        const validationResults = corrections.map(c => {
            return {
                instancePath: `/rounds/${c.roundIndex}/questions/${c.questionIndex}`,
                message: `AI Fact Check (${c.action.toUpperCase()}): ${c.reason}`,
                keyword: `ai-fact-check-${c.action}`,
                params: { 
                    action: c.action, 
                    reason: c.reason,
                    verification: c.verification,
                    updatedQuestion: c.updatedQuestion 
                },
                // Add a custom property for the UI to distinguish severity
                severity: c.action === 'remove' ? 'error' : 'warning'
            };
        });

        return {
            valid: validationResults.length === 0,
            errors: validationResults, // Standard field for UI
            corrections: corrections   // Raw field for generator
        };

    } catch (error) {
        console.error("AI Fact-Check failed:", error);
        return { valid: true, errors: [], corrections: [] }; 
    }
}

function getMockQuiz(userPrompt) {
    return {
        "title": `AI Quiz: ${userPrompt}`,
        "description": "This is a sample quiz generated because the AI service is currently unavailable or over quota.",
        "rounds": [
            {
                "title": "General Knowledge",
                "description": "A mix of interesting facts.",
                "questions": [
                    {
                        "type": "multiple-choice",
                        "text": "Which of these was the first feature-length animated movie ever released?",
                        "options": ["Snow White and the Seven Dwarfs", "Pinocchio", "Fantasia", "Dumbo"],
                        "answer": "Snow White and the Seven Dwarfs",
                        "searchQuery": "Walt Disney 1930s studio animation desk",
                        "imageDescription": "A vintage photo of a Disney animator's desk from the 1930s to set the era without showing the characters.",
                        "reasoning": "Snow White was released in 1937. Searching for the studio desk provides context without spoiling the answer."
                    },
                    {
                        "type": "number-exact",
                        "text": "How many minutes are there in a full week?",
                        "answer": 10080,
                        "searchQuery": "clock face time lapse",
                        "imageDescription": "A clock showing the passage of time",
                        "reasoning": "60 minutes * 24 hours * 7 days = 10,080 minutes."
                    }
                ]
            }
        ]
    };
}
