---
name: phaser4-feature-development
description: 'Design and implement new gameplay code and features in Phaser 4 and newer projects. Use for scene architecture, feature planning, ECS-style systems, rendering pipelines, input, physics integration, tooling, and production-ready implementation guidance.'
argument-hint: 'Describe the new feature, current architecture, Phaser version, and target platform'
user-invocable: true
---

# Phaser 4+ Feature Development

## What This Skill Produces
This skill produces implementation-ready plans and code changes for new Phaser 4+ features, including:
- Feature decomposition into systems, scene responsibilities, and data flow
- API-level implementation guidance for Phaser 4+ patterns. If a required API is unconfirmed or absent in available Phaser 4 documentation, explicitly flag it as unverified, describe the intended pattern, and provide a fallback implementation the user can adapt when the API stabilizes.
- Test and validation checkpoints for stable rollout

## Scope Guard
This skill targets Phaser 4 and newer only.
- If the project is Phaser 3 or earlier, stop and recommend using the Phaser 3 skill.
- If the Phaser version is unknown, ask for the exact version before implementation.

## External References
Consult these references when planning or implementing features:
- [External Phaser 4+ Guides](./references/external-guides.md)

## When to Use
Use this skill when you need to:
- Build net-new gameplay mechanics or content pipelines
- Add new scenes, world systems, UI layers, or progression loops
- Introduce reusable feature modules with clean ownership boundaries
- Implement performance-aware features for desktop and mobile browsers
- Plan phased delivery for large feature sets

## Inputs To Collect First
- Exact Phaser version (must be 4+)
- Language/tooling (TypeScript or JavaScript, bundler/build setup)
- Target platforms and performance constraints
- Existing architecture constraints (scene graph, data ownership, event model)
- Feature requirements: user story, acceptance criteria, failure cases
- Assets and dependencies needed (audio, sprites, maps, external services)

## Development Workflow
1. Confirm scope and acceptance criteria.
- Define the user-visible behavior and non-goals.
- Identify edge cases and failure modes up front.

2. Design integration points.
- Decide where the feature lives (scene, system, service, plugin).
- Define input/output contracts and event boundaries.

3. Plan implementation slices.
- Break work into incremental milestones that each run end-to-end.
- Prioritize one vertical slice first for risk reduction.

4. Implement with clear ownership.
- Keep rendering, simulation, and state orchestration responsibilities separate.
- Prefer explicit data flow over implicit cross-scene coupling.

5. Add validation hooks.
- Add focused checks for feature correctness and regressions.
- Validate behavior under expected load and on target devices.

6. Harden for production.
- Remove avoidable allocations in hot paths.
- Ensure scene transitions do not leak listeners, timers, or entities.
- Verify build output, asset paths, and runtime startup behavior.

## Decision Rules
- Small feature with low coupling:
  - Implement directly in the owning scene/system with minimal abstraction.
- Cross-cutting feature touching many scenes:
  - Introduce a shared service/plugin with explicit lifecycle boundaries.
- Performance-sensitive feature:
  - Prototype first, profile early, then optimize only measured hotspots.
- Unclear requirements:
  - Pause coding and request acceptance criteria before proceeding.

## Quality Criteria
A Phaser 4+ feature is complete when:
- Acceptance criteria are met with no known critical regressions.
- Scene/system ownership is explicit and maintainable.
- Maintains ≥60fps on mid-range mobile (e.g. 2020-era Android) under expected peak load, as measured by the browser performance profiler.
- Lifecycle cleanup is verified across reloads and scene transitions.
- A short rollout note exists: what changed, risks, and follow-up tasks.

## Prompt Starters
- "Design and implement a new grappling-hook mechanic for my Phaser 4 platformer."
- "Add an inventory and equipment feature to my Phaser 4 RPG with clean system boundaries."
- "Plan and build a wave-spawning enemy system for Phaser 4 with scalable difficulty."
- "Implement a quest tracker UI and objective state flow in Phaser 4."
- "Refactor my new feature into reusable Phaser 4+ systems with minimal scene coupling."
