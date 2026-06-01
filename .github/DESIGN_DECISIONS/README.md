# Design Decisions

This folder contains focused, short design-decision documents that record architectural choices, conventions, and contracts used by the codebase. Documents here are intended to be machine- and human-discoverable (e.g., by AI coding agents and reviewers).

Current documents

- [IMAGE_SELECTION.md](IMAGE_SELECTION.md) — Image-selection DOM contract and delegated handler expectations.

How to add a new decision

1. Create a new markdown file named `FEATURE_NAME.md` describing the decision, reasons, and any required DOM/API contract.
2. Add a one-line entry to this README linking the new file.
3. Optionally add a pointer line to `.github/copilot-instructions.md` if the decision requires extra attention from agents.

Agent guidance

- Agents should read `.github/DESIGN_DECISIONS/*` on startup to discover guaranteed contracts and conventions before making changes.

Conventions

- Keep each document short (one page).
- Include example snippets where helpful.
- Update documents if the code or global handlers change.

