
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
- Always favor running a database migration on existing data instead of extending the code to handle multiple versions of database schemas.
- When performing database migrations, prioritize safety:
  - Log the number of documents affected.
  - Use "dry run" logging to verify changes before applying them.
  - Ensure scripts are idempotent (safe to run multiple times).
  - Verify data integrity immediately after the migration.

**Ben: Hold me accountable to this. If I slip into over-engineering, remind me of these promises.** 🎯
   - Quiz-specific → Put in `/games/quiz/`
