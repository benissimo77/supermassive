# External Best-Practice Guides for Phaser 4+

Use these sources in priority order. Prefer official Phaser Studio materials first, then community content.

## Tier 1: Official and Version-Accurate

1. Phaser Repository README (v4 overview, setup, architecture notes)
- URL: https://github.com/phaserjs/phaser
- Why it matters: canonical entry for current version, install paths, v4 feature highlights, and links to changelog/migration resources.

2. Phaser v4 Migration Guide
- URL: https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md
- Why it matters: highest-signal breaking-change and architecture-shift guide (render nodes, filters, tint, camera matrix, shader and texture changes).

3. Phaser v4 Changelog
- URL: https://github.com/phaserjs/phaser/tree/master/changelog/v4
- Why it matters: release-by-release behavior changes and fixes that often explain subtle regressions.
- Current example: https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.1/CHANGELOG-v4.1.0.md

4. Phaser Releases
- URL: https://github.com/phaserjs/phaser/releases
- Why it matters: concise release context, highlight summaries, and discussion links around new APIs.

5. Official Phaser Skill Library (inside Phaser repo)
- URL: https://github.com/phaserjs/phaser/tree/master/skills
- Why it matters: curated subsystem skills from the Phaser team and community contributors. Useful for scene, tilemap, physics, input, and migration-specific patterns.

6. Phaser Type Definitions
- URL: https://github.com/phaserjs/phaser/tree/master/types
- Why it matters: practical source of API truth for TypeScript signatures and editor-assisted correctness.

## Tier 2: Official Product Surfaces

1. API Documentation
- URL: https://docs.phaser.io/
- Use for: class-level API details and method signatures.

2. Phaser Examples
- URL: https://phaser.io/examples
- Use for: implementation patterns and runnable reference snippets.

3. Create Phaser Game CLI Tutorial
- URL: https://phaser.io/tutorials/create-game-app
- Use for: modern project scaffolding and supported framework/bundler patterns.

## Tier 3: Community Knowledge (Verify Against Tier 1)

1. Phaser Forum
- URL: https://phaser.discourse.group/
- Use for: edge cases and real-world troubleshooting.

2. Phaser Discord
- URL: https://discord.gg/phaser
- Use for: current ecosystem practices and quick sanity checks.

## Agent Retrieval Strategy

1. Always confirm exact Phaser version first.
2. For new feature work, start with repository README and latest v4 changelog.
3. For cross-version or legacy code influence, consult migration guide before coding.
4. For API uncertainty, verify with docs and type definitions.
5. For implementation shape, check examples and official skills.
6. Use community sources only to complement, not override, official guidance.

## Best-Practice Synthesis Checklist

- Version-specific: recommendation explicitly matches target Phaser version.
- API-accurate: methods/properties validated against docs or types.
- Architecture-aware: reflects v4 render-node and filter model where relevant.
- Performance-aware: avoids premature optimization and references measured bottlenecks.
- Lifecycle-safe: scene transitions and cleanup are considered.
- Reproducible: proposal includes validation steps and expected outcomes.
