# SuperMassive Player "Juice" Roadmap

This document tracks ideas for enhancing the visual presence of players (`PhaserPlayer.ts`) to increase engagement, retention, and "bragging rights" during broadcasts.

## 1. Visual Tiers & Progression
Players "level up" their appearance based on their rank, score, or all-time level.

| Tier | Name | Visual Style |
| :--- | :--- | :--- |
| **Level 1** | Newbie | Standard Gray panel, Blue border. |
| **Level 10** | Pro | Thicker borders, subtle drop shadow. |
| **Level 25** | Champ | Brushed Silver/Aluminum texture, metallic shine. |
| **Level 50** | Master | Polished Gold texture, constant `ShineFX`. |
| **Level 75** | Ninja | Embossed/3D text effect, glowing borders. |
| **Level 100** | God | Rainbow Neon cycling border, Obsidian panel. |

## 2. Achievement & Status Markers
Small icons or "pins" attached to the name panel.
- **Verified Checkmark**: For staff, VIPs, or authenticated accounts.
- **Crown**: For the current all-time leaderboard leader.
- **Trophy**: For previous tournament winners.
- **Flame Icon**: For players on a "Winning Streak" (e.g., 5+ correct answers in a row).

## 3. Dynamic Effects (The "Juice")
Animations triggered by game events.
- **Podium Stars**: Floating gold stars/sparkles around the top 3 winners during the final reveal.
- **On Fire**: A heat-haze or flame particle effect for high-streak players.
- **Leaderboard Pulse**: The #1 player's panel has a slow "breathing" scale animation.
- **Impact Flash**: A white flash or "impact" effect when a player moves up a rank.

## 4. Avatar Customization (Long-Term)
Overlaying accessories onto the player's chosen avatar.
- **Hats**: Party hats, crowns, viking helmets.
- **Shades**: Cool sunglasses, laser eyes.
- **Auras**: Glowing rings or wings behind the avatar.

## 5. Technical Implementation Ideas
- Use Phaser `PostFX` (Shine, Bloom, Glow) for metallic/neon effects.
- Use `Phaser.GameObjects.Particles` for stars, flames, and sparkles.
- Use `RenderTexture` in `PhaserPlayer` to composite these layers efficiently.
