import { ThreeCard } from './ThreeCard';
import { ThreePlayer } from './ThreePlayer';

/**
 * Snapshot of the scene elements an Action needs to choreograph JOKER_EVALUATE.
 * Passed into getTimeline() so the Action can animate anything it needs —
 * containers, players, cards — without holding a permanent reference to the scene.
 */
export interface ThreeSceneRefs {
    battleContainer: Phaser.GameObjects.Container;
    gridContainer: Phaser.GameObjects.Container;
    players: Map<string, ThreePlayer>;
    cards: ThreeCard[];
    /** Moves a game object from its current container into a new one, preserving world position. */
    reparentObject: (obj: Phaser.GameObjects.GameObject, newParent: Phaser.GameObjects.Container) => void;
    /** Returns a paused timeline that places all battle-team players into their battle slots. */
    doBattleSetup: () => gsap.core.Timeline;
}
