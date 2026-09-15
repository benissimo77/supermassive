import { gsap } from "gsap";

import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { PlayerConfig } from "../PhaserPlayer";

/**
 * DrawQuestion - Host side of the 'draw' question type. Canvas drawing is 100% player-side
 * (see PlayerDrawQuestion); the host only shows a waiting message while players draw, or a
 * gallery of submitted drawings once answers are in.
 */
export default class DrawQuestion extends BaseQuestion {
    private waitingMessage: Phaser.GameObjects.Text;

    constructor(scene: BaseScene, questionData: any) {
        super(scene, questionData);
    }

    protected getAnswerUIWidth(): number {
        // Use full width
        return this.scene.scale.width;
    }

    protected createAnswerUI(): void {
        console.log('DrawQuestion::createAnswerUI:', this.questionData.mode);

        this.answerContainer.removeAll(true);

        if (this.questionData.mode === 'ask') {
            // While players are drawing, host just shows a waiting message
            this.waitingMessage = this.scene.add.text(0, 0, "Players are drawing their answers...", {
                fontSize: this.scene.getY(48),
                fontFamily: '"Titan One", Arial',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);

            this.answerContainer.add(this.waitingMessage);
        } else {
            // In answer mode, host displays a gallery of all submitted drawings
            // TODO - allow host to also grade the answers
            this.displayDrawingGallery();
        }
    }

    protected showAnswerContent(answerHeight: number): void {
        // Center the waiting message within the answer area (ask mode only - the drawing
        // gallery positions its own thumbnails in a self-contained grid, independent of answerHeight)
        if (this.waitingMessage) {
            this.waitingMessage.setPosition(0, this.scene.getY(answerHeight) / 2);
        }
    }

    // Host never makes anything interactive (that's PlayerDrawQuestion's job) - kept as
    // no-ops to satisfy BaseQuestion's abstract contract.
    protected makeInteractive(): void {
    }

    protected makeNonInteractive(): void {
    }

    public createRevealAnswerTimeline(): gsap.core.Timeline {
        const tl = this.minimizeQuestionContent();
        this.tl = tl;

        // Draw questions don't have a single "correct" answer to reveal
        // We just return a timeline that could be extended
        return tl;
    }

    private displayDrawingGallery(): void {

        console.log('DrawQuestion::displayDrawingGallery:', this.questionData.results);

        // Create a gallery of all submitted drawings
        if (!this.questionData.results) return;

        const results = this.questionData.results;
        const sessionIDs = Object.keys(results);

        if (sessionIDs.length === 0) {
            const message = this.scene.add.text(0, 0, "No drawings submitted yet", {
                fontSize: this.scene.getY(32),
                fontFamily: '"Titan One", Arial',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);

            this.answerContainer.add(message);
            return;
        }

        // We'll display drawings in a grid - size depends on number of results
        var numCols = 4;
        var padding = 20;
        var drawingWidth = 440;
        var drawingHeight = 330;
        if (sessionIDs.length < 5) {
            numCols = sessionIDs.length;
            drawingWidth = Math.min(1800 / numCols, 1200);
            drawingHeight = drawingWidth * 3 / 4;
            padding = (4 - numCols) * 20;
        }

        sessionIDs.forEach((sessionID, index) => {
            const rowIndex = Math.floor(index / numCols);
            const colIndex = index % numCols;

            // xPos we subtract half the total width since originX is centre
            const xPos = colIndex * (drawingWidth + padding) - (numCols * drawingWidth + (numCols - 1) * padding) / 2;
            const yPos = rowIndex * (drawingHeight + padding);

            const playerDrawing = this.createDrawingThumbnail(
                results[sessionID],
                drawingWidth,
                drawingHeight,
                sessionID
            );

            playerDrawing.setPosition(xPos, yPos);
            this.answerContainer.add(playerDrawing);
        });
    }

    // createDrawingThumbnail
    // Create a miniature version of a drawing canvas
    // Note: this goes against trad Phaser design of origin at the centre - origin here is top left, easier for rendering
    private createDrawingThumbnail(
        drawingData: any,
        width: number,
        height: number,
        sessionID: string
    ): Phaser.GameObjects.Container {
        const container = this.scene.add.container(0, 0);

        // Add a white background
        const bg = this.scene.add.rectangle(0, 0, width, height, 0xFFFFFF);
        bg.setOrigin(0, 0);
        container.add(bg);

        // Create a graphics object for the drawing
        const drawingGraphics = this.scene.add.graphics();
        drawingGraphics.setPosition(0, 0);
        container.add(drawingGraphics);

        // Render the drawing data
        if (Array.isArray(drawingData)) {

            drawingData.forEach(stroke => {
                if (stroke.points.length < 2) return;

                drawingGraphics.lineStyle(stroke.lineWidth * 0.5, stroke.color);

                drawingGraphics.beginPath();
                const startPoint = { x: stroke.points[0].x * width / 1000, y: stroke.points[0].y * height / 1000 };
                drawingGraphics.moveTo(
                    startPoint.x,
                    startPoint.y
                );

                for (let i = 1; i < stroke.points.length; i++) {
                    const point = { x: stroke.points[i].x * width / 1000, y: stroke.points[i].y * height / 1000 };
                    drawingGraphics.lineTo(
                        point.x,
                        point.y
                    );
                }

                drawingGraphics.strokePath();
            });
        }

        // Add player name
        const playerConfig: PlayerConfig | undefined = this.scene.getPlayerConfigBySessionID(sessionID);
        console.log('DrawQuestion::createDrawingThumbnail - playerConfig:', playerConfig);
        if (playerConfig) {
            const playerName = playerConfig.name || `Player ${sessionID}`;
            const label = this.scene.add.text(0, height + this.scene.getY(16), playerName, {
                fontSize: this.scene.getY(24),
                fontFamily: '"Titan One", Arial',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0, 0.5);
            container.add(label);
        }

        return container;
    }
}
