import { gsap } from "gsap";

import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { BaseScene } from "src/BaseScene";
import { PlayerConfig } from "../PhaserPlayer";


export default class DrawQuestion extends BaseQuestion {
    private drawingContainer: Phaser.GameObjects.Container;
    private background: Phaser.GameObjects.Rectangle;
    private canvas: Phaser.GameObjects.Graphics;
    private submitButton: NineSliceButton;
    private clearButton: NineSliceButton;
    private drawingData: Array<{ type: string, points: Array<{ x: number, y: number, pressure?: number }>, color: number, lineWidth: number }> = [];

    private isDrawing: boolean = false;
    private currentStroke: Array<{ x: number, y: number, pressure?: number }> = [];
    private currentColor: number = 0x000000; // Default color: black
    private currentLineWidth: number = 5; // Default line width

    private colorButtons: Map<number, Phaser.GameObjects.Container> = new Map();
    private sizeButtons: Map<number, Phaser.GameObjects.Container> = new Map();
    private controlsPanel: Phaser.GameObjects.Container;

    constructor(scene: BaseScene, questionData: any) {
        super(scene, questionData);
    }

    protected getAnswerUIWidth(): number {
        // Use full width
        return this.scene.scale.width;
    }

    protected createAnswerUI(answerHeight: number): void {
        console.log('DrawQuestion::createAnswerUI:', this.questionData.mode, this.scene.TYPE, answerHeight);

        this.answerContainer.removeAll(true);

        if (this.scene.TYPE === 'host') {
            // For the host screen, show a message like "Players are drawing..."
            if (this.questionData.mode === 'ask') {
                const message = this.scene.add.text(0, 0, "Players are drawing their answers...", {
                    fontSize: this.scene.getY(48),
                    fontFamily: '"Titan One", Arial',
                    color: '#ffffff',
                    align: 'center'
                }).setOrigin(0.5);

                this.answerContainer.add(message);
            } else {
                // In answer mode, host will display gallery of drawings, players are sent a canvas to grade
                // TODO - allow host to also grade the answers
                this.displayDrawingGallery(answerHeight);
            }
        } else {
            // Player screen - add drawing canvas using the full screen
            this.setupDrawingCanvas(answerHeight);
        }
    }


    // SetupDrawingCanvas
    // Create the canvas for collecting user input and displaying graphics
    // Two objects are used:
    // 1. Background rectangle - this collects pointer events and thanks to getBounds() function provides accurate position of canvas
    // 2. Canvas graphics object - this is used to render the actual lines, but other than that it is dumb
    // Above two objects are positioned together so that input and output are aligned
    private setupDrawingCanvas(answerHeight: number): void {

    // Create a container for all drawing-related elements
    this.drawingContainer = this.scene.add.container(-960, 0);
    this.answerContainer.add(this.drawingContainer);

    // Use full screen dimensions (consistent with other questions)
    const canvasWidth = 1920;
    const canvasHeight = this.scene.getY(answerHeight);

    // Create a white background for the canvas that is ALSO interactive
    // Allow 120px (logical) for the control panel on the left
    // Note: there is a reason why we create a rectangle here AND a canvas graphics object
    // The rectangle has a function getBounds() which gives us the position on the screen, ideal for aligning with pointer coordindates
    this.background = this.scene.add.rectangle(120, 0, canvasWidth-120, canvasHeight, 0xDDDDDD);
    this.background.setOrigin(0, 0);
    this.background.setInteractive({ useHandCursor: true });
    this.drawingContainer.add(this.background);
    
    // Create the drawing canvas using Phaser Graphics
    this.canvas = this.scene.add.graphics({ x: 120, y: 0 });
    this.drawingContainer.add(this.canvas);

    // If we're in answer mode, disable drawing and show the submitted drawing
    if (this.questionData.mode === 'answer') {
        this.displaySubmittedDrawing();
        return;
    }

    // Add event listeners directly to the background rectangle
    this.background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.isDrawing = true;
        this.currentStroke = [];
        this.addPointToStroke(pointer);
    });

    this.background.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (this.isDrawing) {
            this.addPointToStroke(pointer);
            this.renderStroke();
        }
    });

    this.background.on('pointerup', () => {
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.currentStroke.length > 1) {
                // Save the stroke to our drawing data
                this.drawingData.push({
                    type: 'stroke',
                    points: [...this.currentStroke],
                    color: this.currentColor,
                    lineWidth: this.currentLineWidth
                });
            }
            this.currentStroke = [];
        }
    });

    this.background.on('pointerout', () => {
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.currentStroke.length > 1) {
                // Save the stroke to our drawing data
                this.drawingData.push({
                    type: 'stroke',
                    points: [...this.currentStroke],
                    color: this.currentColor,
                    lineWidth: this.currentLineWidth
                });
            }
            this.currentStroke = [];
        }
    });

    // Add vertical control panel on left side
    this.createControlPanel(answerHeight);

    // Add submit button at the bottom of the canvas
    this.submitButton = new NineSliceButton(this.scene, 'Submit');
    this.submitButton.setButtonSize(200, 80);
    this.submitButton.setPosition(960 - 100 - 20, this.scene.getY(answerHeight - 40 - 20));
    this.submitButton.setInteractive({ useHandCursor: true });
    this.submitButton.on('pointerup', () => {
        this.submitDrawing();
    });
    this.answerContainer.add(this.submitButton);

    }

    private createControlPanel(answerHeight: number): void {

        const canvasHeight = this.scene.getY(answerHeight);

        // Create a container for controls (120 width, answerHeight height)
        this.controlsPanel = this.scene.add.container(60, canvasHeight / 2);
        this.drawingContainer.add(this.controlsPanel);

        // Semi-transparent background for the control panel
        const panelBg = this.scene.add.rectangle(0, 0, 120, canvasHeight, 0x333333, 0.7);
        panelBg.setOrigin(0.5, 0.5);
        panelBg.setStrokeStyle(1, 0xFFFFFF, 0.3);
        this.controlsPanel.add(panelBg);

        // Panel title
        const titleText = this.scene.add.text(0, -canvasHeight / 2 + 20, "TOOLS", {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.controlsPanel.add(titleText);

        // Add color picker - vertical layout
        this.addColorPicker(-canvasHeight / 2 + 80);

        // Add line width picker - vertical layout
        this.addLineWidthPicker(-canvasHeight / 2 + 80 + 8 * 50 + 50); // 8 colors, each spaced by 50px

        // Add action buttons at the bottom
        this.addActionButtons(canvasHeight / 2 - 20);
    }

    private addColorPicker(startY: number): void {

        // The palette of colors available to users
        const colors: { color: number, name: string }[] = [
            { color: 0x000000, name: 'Black' },
            { color: 0xFF0000, name: 'Red' },
            { color: 0x0000FF, name: 'Blue' },
            { color: 0x00FF00, name: 'Green' },
            { color: 0xFFFF00, name: 'Yellow' },
            { color: 0xFF00FF, name: 'Purple' },
            { color: 0xFFA500, name: 'Orange' },
            { color: 0xFFFFFF, name: 'White' }
        ];

        const spacing = 50;
        let yPos = startY;

        // Add "Colors" label
        const colorsLabel = this.scene.add.text(0, yPos - 30, "COLORS", {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.controlsPanel.add(colorsLabel);

        colors.forEach(colorInfo => {
            const colorButton = this.createColorButton(colorInfo.color, colorInfo.name);
            colorButton.setPosition(0, yPos);
            this.controlsPanel.add(colorButton);
            this.colorButtons.set(colorInfo.color, colorButton);

            if (colorInfo.color === this.currentColor) {
                this.highlightColorButton(colorInfo.color);
            }

            yPos += spacing;
        });
    }

    private createColorButton(color: number, name: string): Phaser.GameObjects.Container {
        const container = this.scene.add.container(0, 0);

        const buttonSize = 36;
        const bg = this.scene.add.circle(0, 0, buttonSize / 2, color);
        bg.setStrokeStyle(2, 0x000000);

        container.add(bg);
        container.setSize(buttonSize, buttonSize);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerup', () => {
            this.currentColor = color;
            this.highlightAllButtons();
        });

        // Add tooltip on hover
        container.on('pointerover', () => {
            const tooltip = this.scene.add.text(30, 0, name, {
                fontSize: '14px',
                backgroundColor: '#000000',
                padding: { x: 5, y: 3 },
                color: '#ffffff'
            }).setOrigin(0, 0.5);

            container.add(tooltip);

            // Store the tooltip for removal
            container.setData('tooltip', tooltip);
        });

        container.on('pointerout', () => {
            const tooltip = container.getData('tooltip');
            if (tooltip) {
                tooltip.destroy();
                container.setData('tooltip', null);
            }
        });

        return container;
    }

    private highlightColorButton(color: number): void {
        this.colorButtons.forEach((button, buttonColor) => {
            const isSelected = buttonColor === color;
            const bg = button.getAt(0) as Phaser.GameObjects.Shape;

            if (isSelected) {
                bg.setStrokeStyle(4, 0xFFFFFF);
                button.setScale(1.2);
            } else {
                bg.setStrokeStyle(2, 0x000000);
                button.setScale(1);
            }
        });
    }

    private addLineWidthPicker(startY: number): void {

        // Available line widths
        const lineWidths: number[] = [2, 5, 10, 20, 30];

        const spacing = 50;
        let yPos = startY;

        // Add "Brush Size" label
        const sizeLabel = this.scene.add.text(0, yPos - 30, "BRUSH SIZE", {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.controlsPanel.add(sizeLabel);

        lineWidths.forEach(width => {
            const sizeButton = this.createSizeButton(width);
            sizeButton.setPosition(0, yPos);
            this.controlsPanel.add(sizeButton);
            this.sizeButtons.set(width, sizeButton);

            if (width === this.currentLineWidth) {
                this.highlightSizeButton(width);
            }

            yPos += spacing;
        });
    }

    private createSizeButton(width: number): Phaser.GameObjects.Container {
        const container = this.scene.add.container(0, 0);

        const buttonSize = 36;
        const bg = this.scene.add.circle(0, 0, buttonSize / 2, 0xDDDDDD);
        bg.setStrokeStyle(2, 0x000000);

        // Add a circle representing the line width
        const sizeIndicator = this.scene.add.circle(0, 0, width / 2, 0x000000);

        container.add([bg, sizeIndicator]);
        container.setSize(buttonSize, buttonSize);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerup', () => {
            this.currentLineWidth = width;
            this.highlightAllButtons();
        });

        // Add tooltip on hover
        container.on('pointerover', () => {
            const tooltip = this.scene.add.text(30, 0, `${width}px`, {
                fontSize: '14px',
                backgroundColor: '#000000',
                padding: { x: 5, y: 3 },
                color: '#ffffff'
            }).setOrigin(0, 0.5);

            container.add(tooltip);

            // Store the tooltip for removal
            container.setData('tooltip', tooltip);
        });

        container.on('pointerout', () => {
            const tooltip = container.getData('tooltip');
            if (tooltip) {
                tooltip.destroy();
                container.setData('tooltip', null);
            }
        });

        return container;
    }

    private highlightSizeButton(width: number): void {
        this.sizeButtons.forEach((button, buttonWidth) => {
            const isSelected = buttonWidth === width;
            const bg = button.getAt(0) as Phaser.GameObjects.Shape;

            if (isSelected) {
                bg.setStrokeStyle(4, 0xFFFFFF);
                button.setScale(1.2);
            } else {
                bg.setStrokeStyle(2, 0x000000);
                button.setScale(1);
            }
        });
    }

    private addActionButtons(yPos: number): void {

        // Clear button
        this.clearButton = new NineSliceButton(this.scene, 'Clear');
        this.clearButton.setButtonSize(80, 40);
        this.clearButton.setPosition(0, yPos);
        this.clearButton.setInteractive({ useHandCursor: true });
        this.clearButton.on('pointerup', () => {
            this.clearCanvas();
        });
        this.controlsPanel.add(this.clearButton);
    }

    private highlightAllButtons(): void {
        this.highlightColorButton(this.currentColor);
        this.highlightSizeButton(this.currentLineWidth);
    }



    private addPointToStroke(pointer: Phaser.Input.Pointer): void {

        // NOTE: pointer passed in is in global screen coordinates, not relative to the canvas or drawingContainer
        console.log('DrawQuestion::addPointToStroke:', pointer.x, pointer.y);

        const bounds = this.background.getBounds();
        console.log('Background Screen bounds:', bounds.x, bounds.y, bounds.width, bounds.height);

        // Get the current canvas size (baseSize or displaySize - they are the same)
        // We need to convert logical coordinates to background rectangle coordinates
        const displayW = this.scene.scale.displaySize.width;        
        const screenScale:number = 1920 / displayW;

        // Convert pointer coordinates to logical coordinates
        const logicalX = pointer.x * screenScale;
        const logicalY = pointer.y * screenScale;

        console.log('Converting BACK to world space:', logicalX, logicalY);

        // Normalize to 0-1000 range for storage
        const normalizedX = Math.round(1000 * (logicalX - bounds.x) / bounds.width);
        const normalizedY = Math.round(1000 * (logicalY - bounds.y) / bounds.height);
        console.log('Normalized coordinates:', normalizedX, normalizedY);

        this.currentStroke.push({
            x: normalizedX,
            y: normalizedY,
            pressure: (pointer as any).pressure !== undefined ? (pointer as any).pressure : 1
        });
        console.log('DrawQuestion::addPointToStroke:', this.currentStroke[this.currentStroke.length - 1]);
    }

    // Convert normalized coordinates (0-1000) to canvas coordinates
    // Note: this uses this.background to identify canvas size - so this.background must be correctly set before using this function
    private normalizedToCanvasPosition(pos: {x: number, y: number, pressure?: number}): {x: number, y: number, pressure?: number} {
        const canvasWidth = this.background.getBounds().width;
        const canvasHeight = this.background.getBounds().height;

        // Convert from normalized (0-1000) to canvas coordinates
        const canvasX = pos.x * canvasWidth / 1000;
        const canvasY = pos.y * canvasHeight / 1000;
        
        return { x: canvasX, y: canvasY, pressure: pos.pressure };
    }

    private clearCanvas(): void {
        this.canvas.clear();
        this.drawingData = [];
        this.currentStroke = [];
        this.isDrawing = false;
    }

    private submitDrawing(): void {
        // Disable drawing after submission
        this.makeCanvasNonInteractive();

        // Submit the drawing data as the answer
        console.log('DrawQuestion::submitDrawing:', this.drawingData);
        this.submitAnswer(this.drawingData);

        // Juice - animate the canvas and buttons out
        const tl = gsap.timeline();
        tl.to(this.submitButton, {
            y:2000,
            duration: 0.5,
            ease: 'back.in'
        });
        tl.to(this.controlsPanel, {
            x: -120,
            duration: 0.5,
            ease: 'back.in'
        }, "<");
        tl.to(this.drawingContainer, {
            scale: 0.2,
            duration: 0.5,
            ease: 'power2.inOut'
        });
        tl.to(this.drawingContainer, {
            x: 2000,
            duration: 0.5,
            ease: 'power2.inOut'
        });
        tl.play();

    }

    private makeCanvasNonInteractive(): void {
        this.clearButton.disableInteractive();
        this.submitButton.disableInteractive();
        this.colorButtons.forEach(button => button.disableInteractive());
        this.sizeButtons.forEach(button => button.disableInteractive());

        // Remove all event listeners from the background rectangle
        this.background.removeAllListeners();

    }

    private renderStroke(): void {
            if (this.currentStroke.length < 2) return;

            const lastPoint = this.currentStroke[this.currentStroke.length - 2];
            const currentPoint = this.currentStroke[this.currentStroke.length - 1];
            const lastCanvasPosition = this.normalizedToCanvasPosition(lastPoint);
            const currentCanvasPosition = this.normalizedToCanvasPosition(currentPoint);

            this.canvas.lineStyle(this.currentLineWidth, this.currentColor);
            this.canvas.beginPath();
            this.canvas.moveTo(lastCanvasPosition.x, lastCanvasPosition.y);
            this.canvas.lineTo(currentCanvasPosition.x, currentCanvasPosition.y);
            this.canvas.closePath();
            this.canvas.strokePath();
    }

    private displaySubmittedDrawing(): void {
        // If we have results, show the player's own submission
        console.log('DrawQuestion::displaySubmittedDrawing:', this.questionData.results, this.questionData.sessionId);
        if (this.questionData.results && this.questionData.sessionId) {
            const playerResult = this.questionData.results[this.questionData.sessionId];
            if (playerResult) {
                this.currentStroke = playerResult;
                this.renderStroke();
            }
        }
    }

    private displayDrawingGallery(answerHeight: number): void {

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
            padding = ( 4 - numCols) * 20;
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

            // const debugRect = this.scene.add.rectangle(xPos, yPos, drawingWidth, drawingHeight, 0xFF0000, 1);
            // debugRect.setOrigin(0, 0);
            // this.answerContainer.add(debugRect);

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
                const startPoint = {x: stroke.points[0].x * width / 1000, y: stroke.points[0].y * height / 1000};
                drawingGraphics.moveTo(
                    startPoint.x,
                    startPoint.y
                );

                for (let i = 1; i < stroke.points.length; i++) {
                    const point = {x: stroke.points[i].x * width / 1000, y: stroke.points[i].y * height / 1000};
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

    private renderDrawingFromData(drawingData: any): void {
        if (!Array.isArray(drawingData)) return;

        drawingData.forEach(stroke => {
            if (stroke.points.length < 2) return;

            this.canvas.lineStyle(stroke.lineWidth, stroke.color);
            this.canvas.beginPath();
            this.canvas.moveTo(stroke.points[0].x, stroke.points[0].y);

            for (let i = 1; i < stroke.points.length; i++) {
                this.canvas.lineTo(stroke.points[i].x, stroke.points[i].y);
            }

            this.canvas.strokePath();
        });
    }

    public destroy(): void {
        // Clean up any resources
        if (this.canvas) {
            this.canvas.clear();
        }

        super.destroy();
    }
}


