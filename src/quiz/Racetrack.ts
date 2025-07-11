import { BaseScene } from "src/BaseScene";
import { PhaserPlayer, PlayerConfig } from "src/quiz/PhaserPlayer";
import { gsap } from "gsap";

export class Racetrack extends Phaser.GameObjects.Container {
    public scene: BaseScene;
    private playerMarkers: Map<string, Phaser.GameObjects.Container> = new Map();
    private playerScores: Map<string, number> = new Map();
    private playerConfigs: Map<string, PlayerConfig> = new Map();

    private maxScore: number = 0;
    private trackWidth: number;
    private trackHeight: number;
    private animationDuration: number = 1000; // milliseconds

    private markersContainer: Phaser.GameObjects.Container;
    private lanesContainer: Phaser.GameObjects.Container;
    private markers: Phaser.GameObjects.Container[] = [];
    private racetrackScale: number;

    constructor(scene: BaseScene, width: number, height: number) {

        super(scene, 0, 0);
        this.scene = scene;
        this.trackWidth = width;
        this.trackHeight = height;
        this.racetrackScale = 240;

        // Add background for the track
        const background = this.scene.add.rectangle(0, 0, width, height, 0xff3333, 0.3)
            .setOrigin(0, 0);
        this.add(background);

        console.log('Racetrack constructor:', width, height);

        // Create markers container
        this.markersContainer = this.scene.add.container(0, 0);
        this.add(this.markersContainer);

        // Create lanes container
        this.lanesContainer = this.scene.add.container(0, this.scene.getY(60));
        this.lanesContainer.name = 'lanesContainer';
        this.add(this.lanesContainer);


        // Create distance markers
        this.createDistanceMarkers();

        const bounds = this.lanesContainer.getBounds();
        console.log('lane container actual bounds:', bounds.x, bounds.y, bounds.width, bounds.height);
        // Add visual debug rectangle to show container bounds
        // const debugRect = this.scene.add.rectangle(
        //     bounds.x, bounds.y, bounds.width, bounds.height,
        //     0x00ff00, 0.2
        // ).setStrokeStyle(2, 0x00ff00).setOrigin(0);


    }

    // addPlayersToTrack - add players to the racetrack
    // Designed to accept the full list of players - will resort and re-position all players each time someone is added or removed
    public addPlayersToTrack(playerConfigs: PlayerConfig[]): void {

        const [playerStart, playerSpacing] = this.calculatePlayerPositions(
            playerConfigs.length,
            this.trackHeight,
            'top',
            false
        );

        console.log('Racetrack::addPlayersToTrack:', { playerConfigs });
        
        // Sort players by score
        playerConfigs.sort((a, b) => {
            const domA: PhaserPlayer = this.scene.getPlayerBySessionID(a.sessionID) as PhaserPlayer;
            const domB: PhaserPlayer = this.scene.getPlayerBySessionID(b.sessionID) as PhaserPlayer;
            const scoreA = domA.getData('score') || 0;
            const scoreB = domB.getData('score') || 0;
            return scoreB - scoreA; // Highest score first
        });

        // Position each player
        playerConfigs.forEach((player, index) => {

            const phaserPlayer = this.scene.getPlayerBySessionID(player.sessionID) as PhaserPlayer;
            console.log('Racetrack::initialize: player:', phaserPlayer.parentContainer, phaserPlayer.getIndexList(), this.lanesContainer.parentContainer, this.parentContainer);
            const score = phaserPlayer.getData('score') || 0;
            this.lanesContainer.add(phaserPlayer);
            phaserPlayer.x = score * this.racetrackScale;
            phaserPlayer.y = playerStart + (index * playerSpacing);
        });
    }

    public flyIn(): gsap.core.Timeline {
        const duration = 1;
        const tl = gsap.timeline();

        // Start off-screen
        this.x = this.trackWidth;

        // Animate in
        tl.to(this, { x: 0, duration, ease: "power2.out" });

        return tl;
    }

    public flyOut(): gsap.core.Timeline {
        const duration = 1;
        const tl = gsap.timeline();

        tl.to(this, { x: this.trackWidth, duration, ease: "power2.in" });

        return tl;
    }

    public updateScores(scores: { [key: string]: number }): gsap.core.Timeline {

        console.log('Racetrack::updateScores:', scores);

        // Calculate a new scale based on the highest score
        const highestScore = Math.max(...Object.values(scores), 1);
        const newScale = Math.max(1, Math.min(180, Math.floor(1400 / highestScore)));

        const currentScale = this.racetrackScale;
        const scaleObject = { scale: currentScale };

        // Create timeline
        const tl = gsap.timeline();
        const duration = 2;

        // Position markers according to scale
        tl.to(scaleObject, {
            scale: newScale,
            duration: duration,
            ease: 'none',
            onUpdate: () => {
                this.positionMarkers(scaleObject.scale);
            }
        });

        // Set the new scale
        this.racetrackScale = newScale;

        // Update each player
        const playerConfigs = this.scene.getPlayerConfigsAsArray();
        playerConfigs.forEach(playerConfig => {

            const player = this.scene.getPlayerBySessionID(playerConfig.sessionID) as PhaserPlayer;
            const playerScore = parseInt(player.getData('score')) || 0;
            const scoreObject = { score: playerScore };
            const playerNewScore = scores[playerConfig.sessionID];
            player.setData('newScore', playerNewScore);
            player.setData('oldScore', playerScore);
            player.setData('oldScale', currentScale);
            player.setData('newScale', newScale);

            tl.to(scoreObject, {
                score: playerNewScore,
                duration: 2,
                ease: 'none',
                onUpdate: () => {
                    // Update visual score display
                    player.updatePlayerScore(Math.floor(scoreObject.score));
                }
            }, "<");

            // Animate player position
            tl.to(player, {
                x: playerNewScore * this.racetrackScale,
                duration: 2,
                ease: 'none'
            }, "<");

            // Finally update the stored score when animation completes
            player.setData('score', playerNewScore);
        });


        // Calculate and animate overtaking
        const overtakes = this.calculatePlayerOvertakes(playerConfigs);

        // This line should give the same result as when the players were first added
        const [playerStart, playerSpacing] = this.calculatePlayerPositions(
            playerConfigs.length,
            this.trackHeight,
            'top',
            false
        );

        // this.animateOvertakes(overtakes, tl, duration);
        overtakes.forEach((overtake) => {
            // Calculate all scores and order (some will be the same use their final score to decide order)
            playerConfigs.forEach((playerElement) => {
                const p: PhaserPlayer = this.scene.getPlayerBySessionID(playerElement.sessionID) as PhaserPlayer;
                const tScore: number = (p.getData('newScore') - p.getData('oldScore')) * overtake + p.getData('oldScore');
                p.setData('tScore', tScore);
            });
            // Sort player configs by score - highest first
            const sortedPlayers = Array.from(playerConfigs).sort((a, b) => {
                const pa: PhaserPlayer = this.scene.getPlayerBySessionID(a.sessionID) as PhaserPlayer;
                const pb: PhaserPlayer = this.scene.getPlayerBySessionID(b.sessionID) as PhaserPlayer;
                if (pa.getData('tScore') == pb.getData('tScore')) return (pb.getData('newScore') - pa.getData('newScore')); else return pb.getData('tScore') - pa.getData('tScore');
            });
            console.log('Overtake:', overtakes, sortedPlayers);
            for (let i = 0; i < sortedPlayers.length; i++) {
                const player: PhaserPlayer = this.scene.getPlayerBySessionID(sortedPlayers[i].sessionID) as PhaserPlayer;
                const playertl = gsap.timeline();
                playertl.to(player, { y: playerStart + i * playerSpacing, duration: 0.2, ease: 'none', delay: duration * overtake, depth: i });
                tl.add(playertl, "<");
            }
        })

        return tl;
    }


    private calculatePlayerPositions(playerCount: number, totalSpace: number, align: string = 'top', distribute: boolean = false): [number, number] {
        const centreLine = totalSpace / 2;
        let elementSpacing = totalSpace / Math.max(playerCount, 1);

        if (!distribute) {
            elementSpacing = Math.min(this.scene.getY(120), elementSpacing);
        }

        let elementStart = centreLine - elementSpacing * (playerCount - 1) / 2;
        if (align === 'top') {
            elementStart = 0;
        } else if (align === 'bottom') {
            elementStart = totalSpace - elementSpacing * (playerCount - 1);
        }

        return [elementStart, elementSpacing];
    }

    private createDistanceMarkers(): void {
        // Create markers every 10 points up to 50, then every 25
        const distances = [1, 2, 3, 4, 5, 10, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200];

        distances.forEach(distance => {
            const marker = this.createMarker(distance);
            marker.setPosition(distance * this.racetrackScale, 0);
            this.markersContainer.add(marker);
            this.markers.push(marker);
        });
    }

    createMarker(distance: number): Phaser.GameObjects.Container {
        const container = this.scene.add.container(0, 0);

        // Create marker line
        const markerLine = this.scene.add.rectangle(0, 0, 3, this.scene.getY(20), 0xcccccc)
            .setOrigin(0.5, 0);
        container.add(markerLine);

        // Create distance text
        const distanceText = this.scene.add.text(0, 0, distance.toString())
            .setFontSize(this.scene.getY(32))
            .setFontFamily('Arial')
            .setColor('#ffffff')
            .setOrigin(0.5, 1);
        container.add(distanceText);

        container.setData('distance', distance);

        return container;
    }

    positionMarkers(scale: number): void {
        this.markers.forEach(marker => {
            const distance = marker.getData('distance');
            marker.setPosition(distance * scale, 0);
        });
    }


    calculatePlayerOvertakes(playerConfigs: PlayerConfig[]): number[] {
        const overtakes = new Set<number>();

        for (let i = 0; i < playerConfigs.length - 1; i++) {
            const p1: PhaserPlayer = this.scene.getPlayerBySessionID(playerConfigs[i].sessionID) as PhaserPlayer;
            const m1 = p1.getData('newScore') * p1.getData('newScale') -
                p1.getData('oldScore') * p1.getData('oldScale');
            const c1 = p1.getData('oldScore') * p1.getData('oldScale');

            for (let j = i + 1; j < playerConfigs.length; j++) {
                const p2: PhaserPlayer = this.scene.getPlayerBySessionID(playerConfigs[j].sessionID) as PhaserPlayer;
                const m2 = p2.getData('newScore') * p2.getData('newScale') -
                    p2.getData('oldScore') * p2.getData('oldScale');
                const c2 = p2.getData('oldScore') * p2.getData('oldScale');

                if (m2 != m1) {
                    const t = (c2 - c1) / (m1 - m2);
                    if ((t >= 0) && (t < 1)) {
                        overtakes.add(t);
                    }
                }
            }
        }

        return Array.from(overtakes).sort();
    }

    animateOvertakes(overtakes: number[], timeline: gsap.core.Timeline, duration: number): void {
        // Calculate player positions
        const playerSpacing = this.height * 0.2;
        const playerStartY = this.height * 0.1;

        overtakes.forEach(overtakeTime => {
            // Get current positions at this point in time
            const playersWithPosition = Array.from(this.playerMarkers.entries()).map(([id, marker]) => {
                const oldScore = marker.getData('oldScore') || 0;
                const newScore = marker.getData('newScore') || 0;
                const scoreAtTime = oldScore + (newScore - oldScore) * overtakeTime;

                return {
                    id,
                    marker,
                    score: scoreAtTime,
                    finalScore: newScore
                };
            });

            // Sort by score at this time point
            playersWithPosition.sort((a, b) => {
                // If scores are equal, sort by final score
                if (a.score === b.score) return b.finalScore - a.finalScore;
                return b.score - a.score;
            });

            // Animate position changes
            playersWithPosition.forEach((player, index) => {
                const newY = playerStartY + index * playerSpacing;

                timeline.to(player.marker, {
                    y: newY,
                    duration: 0.2,
                    ease: 'none',
                    delay: duration * overtakeTime,
                    zIndex: index
                }, "<");
            });
        });
    }

}