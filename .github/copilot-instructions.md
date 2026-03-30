
---
# SuperMassive AI Coding Agent Guide

## Big Picture

- **SuperMassive** is a multi-game platform (quiz, drawing, trivia, etc.) with a focus on rapid game development and extensibility.
- **Architecture:** Each game is self-contained. Shared infrastructure (scenes, utilities) lives in `/src/scenes/` and `/src/utils/`. Game-specific logic stays in `/src/games/[game]/`.
- **Frontend:** Phaser (TypeScript/JS), modular scenes for Host/Player.
- **Backend:** Node.js/Express, game logic in `/server/games/`, MongoDB for storage.
- **Data Flow:** Server manages rooms/game state, Host/Player screens connect via websockets.

## Developer Workflows

- **Start Dev Environment:** Use `npm start` (runs both rollup and server in parallel).
- **Frontend:** Edit in `/src/`, assets in `/public/`.
- **Backend:** Edit in `/server/`.
- **Deploy/Sync:** Use `scp` or similar to update remote servers (see recent terminal usage).
- **No formal test suite**—focus is on rapid iteration and manual testing.

## Code Stability Levels (Risk Management)

To prevent regressions in fundamental systems, categorize files by their impact:

- **Level 1: Core Infrastructure (CRITICAL RISK)**
  - **Files:** `server.js`, `server/room.js`, `server/socketserver.js`, `src/BaseScene.ts`, `src/socketManager.ts`.
  - **Rule:** These are the "foundation." Changes here affect every game and every connection. Be extremely reluctant to modify logic. Always double-check variable names (e.g., `name` vs `key`) and state transitions.
- **Level 2: Shared Utilities & Models (HIGH RISK)**
  - **Files:** `src/utils/`, `server/services/`, `server/models/`.
  - **Rule:** Verify how many different games or scenes use these. A change for the Quiz might break the Drawing game.
- **Level 3: Game-Specific Logic (MEDIUM RISK)**
  - **Files:** `server/games/`, `src/quiz/`, `src/lobby/`.
  - **Rule:** Changes are contained to one game. Focus on ensuring the game state machine remains robust.
- **Level 4: UI & Leaf Components (LOW RISK)**
  - **Files:** Individual question types (e.g., `MultipleChoice.ts`), specific UI panels, CSS.
  - **Rule:** Safe for rapid iteration and visual polish.

## Project-Specific Conventions

- **Minimal abstractions:** Avoid base classes for quiz/game concepts. Prefer functions and composition.
- **Quiz-specific code:** Keep in `/games/quiz/`. Don’t generalize unless a second game needs it.
- **Shared utilities:** Only extract to `/utils/` if used by multiple games (e.g., `ImageLoader.ts`).
- **Naming:** camelCase for functions/vars, PascalCase for classes/components.
- **Comments:** Above the code they refer to, explain non-obvious logic.
- **Error handling:** Use async/await and try/catch.

## Patterns & Anti-Patterns

- **Good:** Generic scenes (`HostScene.ts`, `PlayerScene.ts`), shared loaders, minimal code to ship.
- **Bad:** BasePresenter, BaseQuestion, design patterns, over-abstracting for “future flexibility.”
- **Phaser:** Extending Phaser classes is OK, but avoid deep inheritance.

## Integration Points

- **Websockets:** Used for real-time game state sync (see `/server/socketserver.js`).
- **Assets:** `/public/` for static, `/host/` for host-only.
- **Game data:** `/quizdata/` for quiz content, loaded by backend/frontend as needed.

## When Adding Features

- Always ask: Is this quiz-specific or multi-game? Will Drawing Game #2 use this?
- Start with the minimal version. Extract only when duplication or pain emerges.
- If you’re unsure, keep it simple and functional.

## Key Files/Dirs

- `/src/scenes/HostScene.ts`, `/src/scenes/PlayerScene.ts` — generic scene logic
- `/src/games/quiz/` — quiz-specific UI/logic
- `/src/utils/ImageLoader.ts` — example of a good shared utility
- `/server/games/` — backend logic per game
- `/public/`, `/host/` — static assets

---
## Project Philosophy & AI Promises (Retained Wisdom)

- Don’t architect for 1000 games when you have 0 games. Let patterns emerge after 2-3 games.
- Extract utilities only when they help ALL games.
- Avoid “enterprise” abstractions and design patterns unless a concrete pain emerges.
- If you catch yourself suggesting complexity, STOP and ask: “What specific problem does this solve?”
- Always be able to complete: “This change makes [SPECIFIC TASK] faster/easier because [CONCRETE REASON].”

### Common Mistakes to Avoid

- Creating base classes for game concepts (e.g., BasePresenter, BaseQuestion)
- Centralized game logic for all games (giant if/else)
- Over-abstracting before patterns emerge

### Green Light Phrases

- “This utility is useful for all games”
- “Adding game #2 only requires these 3 files”
- “This code is duplicated in 5 places and diverging”

### Red Flag Phrases

- “This follows the [pattern name] pattern”
- “Better separation of concerns”
- “Future-proof design”

### AI Promises

- Question complexity before suggesting it
- Show minimal solutions first
- Only suggest abstractions that help ALL games
- Prioritize shipping and working code over “clean architecture”
- **Pause and Assess:** Before starting any large-scale refactor, structural reorganization, or language conversion (like JS to TS), I will pause to assess the complexity and risk. I will explicitly state the plan and wait for confirmation if the change is likely to destabilize the build or requires "blind" editing of large files.
- **Respect Stability Levels:** I will identify the "Stability Level" of a file before editing. For Level 1 and 2 files, I will be extra cautious, explain the potential side effects, and verify fundamental assumptions (like property names) before applying changes.
- Always favor running a database migration on existing data instead of extending the code to handle multiple versions of database schemas.
- **Never use terminal scripts for file edits:** I will never run terminal commands (like PowerShell scripts, sed, awk, or node file-system scripts) to manipulate, refactor, or edit files directly. I will ALWAYS use the built-in standard tools (like `replace_string_in_file`, `edit_file`, etc.) to edit codebase files.
- When performing database migrations, prioritize safety:
  - Log the number of documents affected.
  - Use "dry run" logging to verify changes before applying them.
  - Ensure scripts are idempotent (safe to run multiple times).
  - Verify data integrity immediately after the migration.
- **Never go down string replacement rabbit holes:** If `replace_string_in_file` or a typical string exact-matching edit fails due to whitespace formatting, DO NOT repeatedly try guessing the string, compiling tests, or hacking terminal commands. STOP. Re-read the file context properly with `read_file` or ask the human for clarification. Do not get stuck in an editing loop.

---

# The Architect's Guardrails (Anti-Overengineering)

To avoid "The Architect's Trap" (over-abstraction, framework-building, and analysis paralysis), follow these rules for every code change:

### 0. The Sanity Check (Before You Type)
*   **Action:** Stop and perform a 30-second "Sanity Check" before every refactor. 
*   **Question:** Does this change reduce complexity, or just redistribute it? Is there a simpler path that achieves 90% of the goal with 10% of the code?
*   **Rule:** Complexity is the primary negative metric. Prefer flat, readable code over deeply nested or "elegant" abstractions.

### 1. The Rule of Three (Copy-Paste is OK)
*   **Action:** Do not abstract a piece of logic until you have at least 3 distinct use cases (e.g., 3 different games needing the same scoring logic).
*   **Mantra:** "Duplication is cheaper than the wrong abstraction." If you only have two games, let them have duplicate code. It's safer to delete a duplicate later than to "un-soup" a generic engine.

### 2. Tools over Frameworks (The Kitchen Principle)
*   **Action:** Build **Tools** (independent utilities like `TimerService`, `ScoreCalculator`) rather than **Process Frameworks** (giant base classes that dictate the flow of the game).
*   **Mantra:** Share the "Knife" and the "Pan," not the "Recipe." Each game handles its own flow/lifecycle; it just borrows tools from the core.

### 3. Data is the Common Language
*   **Action:** Services and games should communicate via **Plain Data Objects** (POJOs). Avoid passing complex class instances or methods between core and plugins.
*   **Mantra:** "Don't share context, share data." If the Racetrack needs to know the time, pass it a number, not the `Timer` object.

### 4. Taxonomy of Content
When adding new game grouping or branding features, adhere to this hierarchy:
*   **Category:** (Level 0) Quiz vs. Board Game vs. Party. (The top-level tabs).
*   **Format:** (Level 1) The "Blueprint" or Ruleset (e.g., *The Gauntlet*, *Elimination*). This is the engine logic.
*   **Show:** (Level 2) The "Series" or Brand (e.g., *Ben's Movie Night*). This is the creator's identity.
*   **Season/League:** (Level 3) The competitive boundary (e.g., *Winter 2026*). Where scores aggregate.
*   **Episode:** (Level 4) The Content (e.g., *80s Music Trivia*). The actual question/data file.

**Note on One-Offs:** The taxonomy should be optional. A standalone quiz remains a standalone quiz (Episode only) unless the creator chooses to wrap it in a Show/Season structure.

### 5. The YAGNI Checklist
Before creating a new abstraction, ask:
1.  Are there currently 3 different files that would use this immediately?
2.  Does this abstraction actually reduce lines of code, or just hide them?
3.  If a new requirement comes in tomorrow, will this abstraction make it *harder* to change?

---

**Ben: Hold me accountable to this. If I slip into over-engineering, remind me of these promises.** 🎯
   - Quiz-specific → Put in `/games/quiz/`
