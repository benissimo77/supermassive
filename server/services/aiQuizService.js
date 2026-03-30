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
\${JSON.stringify(quizSchemaFile, null, 2)}

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

export async function generateQuizFromAI(userPrompt) {
    // Fallback for development if API key is missing or for testing UI
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('your-')) {
        console.warn("OpenAI API Key missing or invalid. Returning mock data.");
        return getMockQuiz(userPrompt);
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Switched to mini: 20x cheaper and faster, usually avoids tier-1 rate limits
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Generate quiz content based on this request: ${userPrompt}. 
                
                CONTEXT: The user is in a quiz editor. 
                - If they ask to "add a round", generate exactly one round. 
                - If they don't specify counts, default to 1 round of 5 questions. 
                - Always follow specific counts mentioned in their prompt (e.g. "3 questions" or "2 rounds") over the defaults.
                - IMPORTANT: Generate 2 EXTRA questions per round as "spares". These will be used to filter out any low-quality or trivially easy questions.` }
            ],
            response_format: { 
                type: "json_schema",
                json_schema: QUIZ_SCHEMA
            }
        });

        const content = JSON.parse(response.choices[0].message.content);

        // --- DOUBLE-CHECK PIPELINE ---
        const corrections = await validateQuizWithAI(content);
        
        // Apply corrections in reverse order to avoid index shifting if we remove items
        const toRemove = [];
        
        corrections.forEach(correction => {
            const { roundIndex, questionIndex, action, updatedQuestion, reason } = correction;
            if (content.rounds[roundIndex] && content.rounds[roundIndex].questions[questionIndex]) {
                const question = content.rounds[roundIndex].questions[questionIndex];
                
                if (action === 'update' && updatedQuestion) {
                    console.log(`AI Fact-Check: Updating question ${questionIndex} in round ${roundIndex}`);
                    content.rounds[roundIndex].questions[questionIndex] = updatedQuestion;
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
            content.rounds[item.roundIndex].questions.splice(item.questionIndex, 1);
        });

        // Post-process to ensure schema compliance and add heuristic warnings
        if (content.rounds) {
            // Try to determine the "intended" question count to trim spares if they weren't removed
            const countMatch = userPrompt.match(/(\d+)\s*questions?/i);
            const targetCount = countMatch ? parseInt(countMatch[1]) : null;

            content.rounds.forEach(round => {
                // Trim spares if we still have too many (and we have a clear target or we're over the default max)
                if (targetCount && round.questions.length > targetCount) {
                    round.questions = round.questions.slice(0, targetCount);
                } else if (!targetCount && round.questions.length > 8) {
                    // Default max is 8
                    round.questions = round.questions.slice(0, 8);
                }

                // Ensure round defaults
                round.roundTimer = String(round.roundTimer || "0");
                round.showAnswer = round.showAnswer || "round";
                round.updateScores = round.updateScores || "round";

                if (round.questions) {
                    round.questions.forEach(q => {
                        // Ensure basic fields
                        q.searchQuery = q.searchQuery || "";
                        q.imageDescription = q.imageDescription || "";
                        q.reasoning = q.reasoning || "";
                        q.video = q.video || "";
                        q.audio = q.audio || "";

                        // --- HEURISTIC WARNINGS ---
                        const warnings = [];
                        if (q.warning) warnings.push(q.warning);

                        // 1. Too many media types
                        let mediaCount = 0;
                        if (q.imageDescription || q.searchQuery) mediaCount++;
                        if (q.video) mediaCount++;
                        if (q.audio) mediaCount++;
                        if (mediaCount > 2) {
                            warnings.push("This question has multiple media types (Image, Video, Audio). This might be overwhelming for players.");
                        }

                        // 2. Long multiple choice options
                        if (q.type === 'multiple-choice' && q.options) {
                            const longOption = q.options.find(opt => opt.length > 50);
                            if (longOption) {
                                warnings.push("One or more multiple-choice options are very long (>50 chars). They might not display well on mobile.");
                            }
                        }

                        // 3. Ambiguous text answers
                        if (q.type === 'text' && q.answer && q.answer.length > 20) {
                            warnings.push("The text answer is quite long. Consider changing to multiple-choice to avoid player frustration with typos.");
                        }

                        if (warnings.length > 0) {
                            q.warning = warnings.join(" | ");
                        }

                        // Type-specific fixes and defaults
                        switch (q.type) {
                            case 'multiple-choice':
                                if (q.options && q.options.length > 0) {
                                    // If AI provided an answer string, try to find it in options
                                    if (q.answer) {
                                        const index = q.options.findIndex(opt => String(opt).toLowerCase() === String(q.answer).toLowerCase());
                                        if (index !== -1) {
                                            // Move the correct answer to the first slot if it's not already there
                                            const correctOpt = q.options.splice(index, 1)[0];
                                            q.options.unshift(correctOpt);
                                        }
                                    }
                                    // Always set answer to the first option to match schema expectation
                                    q.answer = q.options[0];
                                }
                                break;
                            case 'true-false':
                                q.answer = String(q.answer || "true").toLowerCase();
                                if (q.answer !== 'true' && q.answer !== 'false') q.answer = 'true';
                                break;
                            case 'text':
                                q.answer = String(q.answer || "");
                                break;
                            case 'number-exact':
                            case 'number-closest':
                            case 'number-average':
                                q.answer = q.answer !== undefined ? Number(q.answer) : 0;
                                break;
                            case 'ordering':
                                q.items = q.items || [];
                                q.extra = q.extra || {};
                                // Handle both 'start' and 'startLabel' just in case AI uses the wrong one
                                q.extra.startLabel = q.extra.startLabel || q.extra.start || "Start";
                                q.extra.endLabel = q.extra.endLabel || q.extra.end || "End";
                                break;
                            case 'matching':
                                q.pairs = q.pairs || [];
                                // If AI used different keys (e.g., "term"/"definition"), try to salvage them
                                q.pairs = q.pairs.map(p => {
                                    const keys = Object.keys(p);
                                    return {
                                        left: p.left || p[keys[0]] || "",
                                        right: p.right || p[keys[1]] || ""
                                    };
                                });
                                break;
                            case 'hotspot':
                                q.answer = q.answer || null;
                                break;
                            case 'point-it-out':
                                q.answer = q.answer || null;
                                break;
                        }
                    });
                }
            });
        }

        return content;
    } catch (error) {
        console.error("Error generating quiz with AI:", error);
        
        // If it's a rate limit or quota error, and we are in dev, return mock data so the user can see the UI
        if (error.status === 429 || error.message.includes('quota')) {
            console.log("Returning mock data due to OpenAI Quota/Rate Limit.");
            return getMockQuiz(userPrompt);
        }
        
        throw error;
    }
}

/**
 * Performs a second pass on the generated quiz to fact-check and validate questions.
 */
async function validateQuizWithAI(quizData) {
    console.log('AI Fact-Check: Starting validation pass...');
    
    const validationPrompt = `
    You are a Fact-Checking Editor for a high-stakes trivia show. 
    Your job is to review the following quiz questions and ensure they are 100% accurate and follow the rules.

    RULES:
    1. If a question is factually incorrect, substitute the correct answer.
    2. If a 'text' question has an answer that is too long or ambiguous, change it to a 'multiple-choice' question or simplify the answer.
    3. If a question is nonsensical, cannot be verified, or is TRIVIALLY EASY (e.g. the answer is in the question, or it's common knowledge like "What color is the sky?"), mark it as 'remove'.
    4. If a question is technically correct but might be confusing, subjective, or "clunky", mark it as 'warn' and provide a reason.
    5. Ensure 'multiple-choice' options are plausible but that the first option is definitively the only correct one.
    6. TAUTOLOGY CHECK: If a question contains the answer within itself (e.g. "What is the real name of the composer known as 'Beethoven'?"), it MUST be marked as 'remove'.
    7. SPARE QUESTIONS: You have been provided with extra questions per round. If a question is weak, too easy, or redundant, prefer 'remove' over 'update'. The goal is to leave only the best, most high-quality questions.

    OUTPUT:
    Return a JSON object with a "corrections" array. Each correction should have:
    - "roundIndex": index of the round
    - "questionIndex": index of the question
    - "action": "update", "remove", or "warn"
    - "updatedQuestion": (only if action is "update") the full question object with fixes.
    - "reason": (required for "warn" or "remove") a short explanation of why this action was taken.

    QUIZ DATA:
    \${JSON.stringify(quizData)}
    `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a strict fact-checking editor. Output only valid JSON." },
                { role: "user", content: validationPrompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);
        console.log(`AI Fact-Check: Found \${result.corrections?.length || 0} potential issues.`);
        return result.corrections || [];
    } catch (error) {
        console.error("AI Fact-Check failed:", error);
        return []; // Continue with original data if validation fails
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
