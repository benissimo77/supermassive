import { gsap } from "gsap";

import { BaseScene } from "src/BaseScene";
import { BaseQuestion } from "./BaseQuestion";
import { NineSliceButton } from "src/ui/NineSliceButton";
import { PlayerConfig } from "../PhaserPlayer";
import { Scale } from "phaser";

type Stroke = {
    points: Array<{ x: number; y: number; pressure?: number }>;
    color: number;
    lineWidth: number;
};

export default class DrawQuestion extends BaseQuestion {
    private drawingContainer: Phaser.GameObjects.Container;
    private background: Phaser.GameObjects.Rectangle;
    private canvas: Phaser.GameObjects.Graphics;
    private submitButton: NineSliceButton;
    private clearButton: Phaser.GameObjects.Rectangle;
    private drawingData: Stroke[] = [];

    private isDrawing: boolean = false;
    private currentStroke: Stroke = this.createNewStroke();

    // Control panel
    private controlsPanel: Phaser.GameObjects.Container;
    private colorPickerContainer: Phaser.GameObjects.Container;
    private lineWidthContainer: Phaser.GameObjects.Container;
    private colorButtons: Map<number, Phaser.GameObjects.Container> = new Map();
    private sizeButtons: Map<number, Phaser.GameObjects.Container> = new Map();
    private currentColor: number = 0x000000;
    private currentLineWidth: number = 20;

    constructor(scene: BaseScene, questionData: any) {
        super(scene, questionData);
    }

    protected getAnswerUIWidth(): number {
        // Use full width
        return this.scene.scale.width;
    }

    protected createAnswerUI(): void {
        console.log('DrawQuestion::createAnswerUI:', this.questionData.mode, this.scene.TYPE);

        this.answerContainer.removeAll(true);

        // Create a container for all drawing-related elements
        // Note: looks like we move the origin back to top-left corner, why?
        this.drawingContainer = this.scene.add.container(-960, 0);
        this.answerContainer.add(this.drawingContainer);

        // Place the control panel slightly in from the edge to give a margin
        this.controlsPanel = this.scene.add.container(-960 + 4, 4);
        this.answerContainer.add(this.controlsPanel);

        this.colorPickerContainer = this.scene.add.container(60, 0);
        this.controlsPanel.add(this.colorPickerContainer);

        this.lineWidthContainer = this.scene.add.container(-60, 0);
        this.controlsPanel.add(this.lineWidthContainer);

        if (this.scene.TYPE === 'hostX') {
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
                this.displayDrawingGallery();
            }
        } else {
            // Player screen - add drawing canvas using the full screen
            this.createDrawingCanvas();
            this.createControlPanel();
            
            // Add submit button at the bottom of the canvas
            this.submitButton = new NineSliceButton(this.scene, 'Submit');
            this.submitButton.setButtonSize(200, this.scene.getY(80));
            // this.submitButton.setPosition(960 - 100 - 20, this.scene.getY(answerHeight - 40 - 20));
            this.answerContainer.add(this.submitButton);


            // there might be scenarios where we want a canvas but NOT an interactive one
            // but for now just make it interactive
            this.makeInteractive();
        }
    }

    protected displayAnswerUI(answerHeight: number): void {

        console.log('DrawQuestion::displayAnswerUI:', answerHeight, this.scene.getY(answerHeight), this.scene.isPortrait(), this.scene.cameras.main.zoom, window.devicePixelRatio, this.scene.scale.displayScale);
        this.scene.socket?.emit('consolelog', `DrawQuestion::displayAnswerUI: answerHeight=${answerHeight}, isPortrait=${this.scene.isPortrait()} UIScaleFactor:${this.scene.getUIScaleFactor()} camera zoom: ${this.scene.cameras.main.zoom} devicePixelRatio: ${window.devicePixelRatio} displayScale: ${JSON.stringify(this.scene.scale.displayScale)}`);
        
        // Position and scale submit button (EXACT copy from Number.ts)
		const scaleFactor = this.scene.getUIScaleFactor();
		this.submitButton.setButtonSize(320 * scaleFactor, 80 * scaleFactor);
		this.submitButton.setTextSize(46 * scaleFactor);
		this.submitButton.setPosition(
			960 - 160 * scaleFactor - 20,
			this.scene.getY(answerHeight) - 40 * scaleFactor - 20
		);
		this.answerContainer.add(this.submitButton);	// Ensure button is on top

        // Logic to determine size and position of control panel elements
        if (this.scene.isPortrait()) {

            // Portrait mode - position controls along top
            this.colorPickerContainer.setRotation(-Math.PI / 2);
            this.lineWidthContainer.setRotation(-Math.PI / 2);

            console.log('DrawQuestion::displayAnswerUI: portrait positioning color picker at', this.colorPickerContainer.x, this.colorPickerContainer.y, this.colorPickerContainer.getBounds());
            console.log('DrawQuestion::displayAnswerUI: portrait positioning line width at', this.lineWidthContainer.x, this.lineWidthContainer.y, this.lineWidthContainer.getBounds());
            this.scene.socket?.emit('consolelog', `DrawQuestion::displayAnswerUI: portrait mode - color picker bounds ${JSON.stringify(this.colorPickerContainer.getBounds())}, line width bounds ${JSON.stringify(this.lineWidthContainer.getBounds())}`);

            // Calculate a reasonable scale factor based on the color picker panel - scale up to full width or to a max of 3x normal size
            const scale:number = Math.min( 1920 / (this.colorPickerContainer.getBounds().width), 4);
            this.colorPickerContainer.setScale(scale);
            this.lineWidthContainer.setScale(scale);

            this.colorPickerContainer.setPosition(0, 30 * scale);
            this.lineWidthContainer.setPosition(0, this.colorPickerContainer.getBounds().height + 30 * scale);

        } else {

            this.colorPickerContainer.setRotation(0);
            this.lineWidthContainer.setRotation(0);
            this.colorPickerContainer.setScale(1);
            this.lineWidthContainer.setScale(1);

            // Note: we subtract 8 from answerHeight to allow for the 4 margin top and bottom to fit control panel neatly into canvas
            const scale:number = Math.min( this.scene.getY(answerHeight - 8) / (this.colorPickerContainer.getBounds().height), 3);
            this.colorPickerContainer.setScale(scale);
            this.lineWidthContainer.setScale(scale);


            // Landscape mode - position controls down left side
            // this.colorPickerContainer.setPosition(0, 0);
            console.log('DrawQuestion::displayAnswerUI: positioning color picker at', this.colorPickerContainer.x, this.colorPickerContainer.y, this.colorPickerContainer.getBounds());
            console.log('DrawQuestion::displayAnswerUI: positioning line width at', this.lineWidthContainer.x, this.lineWidthContainer.y, this.lineWidthContainer.getBounds());

            // Can we fit pickers within answerHeight?
            if (this.colorPickerContainer.getBounds().height + this.lineWidthContainer.getBounds().height < this.scene.getY(answerHeight)) {
                this.colorPickerContainer.setPosition(30 * scale, 0);
                this.lineWidthContainer.setPosition(30 * scale, this.colorPickerContainer.getBounds().height);
            } else {
                this.colorPickerContainer.setPosition(30 * scale, 0);
                this.lineWidthContainer.setPosition(90 * scale, 0);
            }

        }

        this.highlightAllButtons();

        // Resize background and canvas to fill the rest of the screen
        // Subtracting 8 from answerHeight just to confirm it reaches bottom of screen
        const newWidth = 1920;
        const newHeight = this.scene.getY(answerHeight);
        this.background.setSize(newWidth, newHeight); // Update interactive area
        this.canvas.clear();
        this.renderDrawingFromData(this.drawingData);

    }

    // SetupDrawingCanvas
    // Create the canvas for collecting user input and displaying graphics
    // Two objects are used:
    // 1. Background rectangle - this collects pointer events and thanks to getBounds() function provides accurate position of canvas
    // 2. Canvas graphics object - this is used to render the actual lines, but other than that it is dumb
    // Above two objects are positioned together so that input and output are aligned
    private createDrawingCanvas(): void {

        // Use full screen dimensions (consistent with other questions)
        // Note: this is just placeholder dimensions - we will size in the display functions later
        const canvasWidth = 1920;
        const canvasHeight = 1080;

        // Create a white background for the canvas that is ALSO interactive
        // Allow 120px (logical) for the control panel on the left
        // Note: there is a reason why we create a rectangle here AND a canvas graphics object
        // The rectangle has a function getBounds() which gives us the position on the screen, ideal for aligning with pointer coordindates
        this.background = this.scene.add.rectangle(0, 0, canvasWidth, canvasHeight, 0xDDDDDD);
        this.background.setOrigin(0, 0);
        this.background.setInteractive({ useHandCursor: true });
        this.drawingContainer.add(this.background);

        console.log('DrawQuestion::createDrawingCanvas: created background at', this.background.x, this.background.y, 'size', this.background.width, this.background.height, this.background.getBounds(), this.scene.scale);

        // Create the drawing canvas using Phaser Graphics - directly overlays background
        this.canvas = this.scene.add.graphics({ x: 0, y: 0 });
        this.drawingContainer.add(this.canvas);

        // If we're in answer mode, disable drawing and show the submitted drawing
        if (this.questionData.mode === 'answer') {
            this.displaySubmittedDrawing();
            return;
        }

    }

    // Create the control panel with color picker, line width picker, and action buttons
    // Note: this design must adapt to portrait or landscape mode
    // So make each element individually and allow them to be sized/positioned based on screen dimensions
    private createControlPanel(): void {

        // Taking the unusual step of creating the control panel entirely when displaying
        // And just destroying and re-creating it each time
        // I think this will in the end be faster since then I don't have to worry about re-sizing/scaling etc
        // Just draw it when I already know the exact size available...

        // If landscape we will display the controls down the left side
        // If portrait we will display controls along the top


        // Create a container for controls (120 width, answerHeight height)
        // Define a placeholder canvasHeight for now...
        // In line with other questions aim to fix the width to 120 logical pixels and see if that works
        const canvasHeight = 120;

        // Semi-transparent background for the control panel
        // const panelBg = this.scene.add.rectangle(0, 0, 120, canvasHeight, 0x333333, 0.7);
        // panelBg.setOrigin(0.5, 0.5);
        // panelBg.setStrokeStyle(1, 0xFFFFFF, 0.3);
        // this.controlsPanel.add(panelBg);

        // Panel title
        // const titleText = this.scene.add.text(0, -canvasHeight / 2 + 20, "TOOLS", {
        //     fontSize: '18px',
        //     fontFamily: 'Arial',
        //     color: '#FFFFFF',
        //     align: 'center',
        //     fontStyle: 'bold'
        // }).setOrigin(0.5);
        // this.controlsPanel.add(titleText);

        // Add color picker - vertical layout
        this.createColorPicker();

        // Add line width picker - vertical layout
        // Note: this also includes the clear canvas button
        this.createLineWidthPicker();
    }

    private createColorPicker(): void {

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

        const spacing: number = 48;

        const bg: Phaser.GameObjects.Rectangle = this.scene.add.rectangle(-30, 0, 60, spacing + colors.length * spacing, 0x222222, 0.5);
        bg.setOrigin(0);
        bg.setStrokeStyle(1, 0xFFFFFF, 0.3);
        this.colorPickerContainer.add(bg);

        // Add "Colors" label
        // const colorsLabel = this.scene.add.text(0, yPos - 30, "COLORS", {
        //     fontSize: '14px',
        //     fontFamily: 'Arial',
        //     color: '#FFFFFF'
        // }).setOrigin(0.5);
        // this.controlsPanel.add(colorsLabel);

        colors.forEach( (colorInfo, index) => {
            const colorButton = this.createColorButton(colorInfo.color, colorInfo.name);
            colorButton.setPosition(0 , spacing + index * spacing);
            this.colorButtons.set(colorInfo.color, colorButton);
            this.colorPickerContainer.add(colorButton);

            // if (colorInfo.color === this.currentColor) {
            //     this.highlightColorButton(colorInfo.color);
            // }

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
        // container.on('pointerover', () => {
        //     const tooltip = this.scene.add.text(30, 0, name, {
        //         fontSize: '14px',
        //         backgroundColor: '#000000',
        //         padding: { x: 5, y: 3 },
        //         color: '#ffffff'
        //     }).setOrigin(0, 0.5);

        //     container.add(tooltip);

        //     // Store the tooltip for removal
        //     container.setData('tooltip', tooltip);
        // });

        // container.on('pointerout', () => {
        //     const tooltip = container.getData('tooltip');
        //     if (tooltip) {
        //         tooltip.destroy();
        //         container.setData('tooltip', null);
        //     }
        // });

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

    private createLineWidthPicker(): void {

        // Available line widths
        const lineWidths: number[] = [7, 12, 20, 32, 48];

        const spacing = 48;
        const padding = 48;

        // Strange addition to generate the height - based on the lineWidths + a button space + button size for clear button
        const bg: Phaser.GameObjects.Rectangle = this.scene.add.rectangle(-30, 0, 60, padding + lineWidths.length * spacing + padding + spacing, 0x220000, 0.5);
        bg.setOrigin(0);
        bg.setStrokeStyle(1, 0xFFFFFF, 0.3);
        this.lineWidthContainer.add(bg);

        // Add "Brush Size" label
        // const sizeLabel = this.scene.add.text(0, yPos - 30, "BRUSH SIZE", {
        //     fontSize: '14px',
        //     fontFamily: 'Arial',
        //     color: '#FFFFFF'
        // }).setOrigin(0.5);
        // this.controlsPanel.add(sizeLabel);

        lineWidths.forEach( (width, index) => {
            const sizeButton = this.createSizeButton(width);
            sizeButton.setPosition(0, padding + index * spacing);
            this.sizeButtons.set(width, sizeButton);
            this.lineWidthContainer.add(sizeButton);

            // if (width === this.currentLineWidth) {
            //     this.highlightSizeButton(width);
            // }
        });

        // Add a clear button in the same panel just for convenience
        const clearButtonY = padding + lineWidths.length * spacing + padding;
        this.clearButton = this.scene.add.rectangle(0, clearButtonY, 36, 36, 0xDDDDDD);
        this.clearButton.setStrokeStyle(2, 0x000000);
        this.clearButton.setSize(36, 36);
        this.clearButton.setInteractive({ useHandCursor: true });
        this.clearButton.on('pointerup', () => {
            this.clearCanvas();
        });
        this.lineWidthContainer.add(this.clearButton);
    }

    private createSizeButton(width: number): Phaser.GameObjects.Container {
        const container = this.scene.add.container(0, 0);

        const buttonSize = 36;
        const bg = this.scene.add.circle(0, 0, buttonSize / 2, 0xDDDDDD);
        bg.setStrokeStyle(2, 0x000000);

        // Add a circle representing the line width - note slightly smaller than the actual width
        const sizeIndicator = this.scene.add.circle(0, 0, width / 3, 0x000000);

        container.add([bg, sizeIndicator]);
        container.setSize(buttonSize, buttonSize);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerup', () => {
            this.currentLineWidth = width;
            this.highlightAllButtons();
        });

        // Add tooltip on hover
        // container.on('pointerover', () => {
        //     const tooltip = this.scene.add.text(30, 0, `${width}px`, {
        //         fontSize: '14px',
        //         backgroundColor: '#000000',
        //         padding: { x: 5, y: 3 },
        //         color: '#ffffff'
        //     }).setOrigin(0, 0.5);

        //     container.add(tooltip);

            // Store the tooltip for removal
        //     container.setData('tooltip', tooltip);
        // });

        // container.on('pointerout', () => {
        //     const tooltip = container.getData('tooltip');
        //     if (tooltip) {
        //         tooltip.destroy();
        //         container.setData('tooltip', null);
        //     }
        // });

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

    private highlightAllButtons(): void {
        this.highlightColorButton(this.currentColor);
        this.highlightSizeButton(this.currentLineWidth);
    }


    // addPointToStroke
    // Does the key job of mapping a pointer position to normalized coordinates and adding to current stroke
    // Ends by rendering the stroke since this happens while live drawing
    private addPointToStroke(pointer: Phaser.Input.Pointer): void {

        // NOTE: pointer passed in is in global screen coordinates, not relative to the canvas or drawingContainer
        console.log('DrawQuestion::addPointToStroke:', pointer.x, pointer.y);

        const bounds = this.background.getBounds();
        console.log('Background Screen bounds:', bounds.x, bounds.y, bounds.width, bounds.height);

        // Get the current canvas size (baseSize or displaySize - they are the same)
        // We need to convert logical coordinates to background rectangle coordinates
        const displayW = this.scene.scale.displaySize.width;
        const screenScale: number = 1920 / displayW;

        // Convert pointer coordinates to logical coordinates
        const logicalX = pointer.x * screenScale;
        const logicalY = pointer.y * screenScale;

        console.log('Converting BACK to world space:', logicalX, logicalY);

        // Normalize to 0-1000 range for storage
        const normalizedX = Math.round(1000 * (logicalX - bounds.x) / bounds.width);
        const normalizedY = Math.round(1000 * (logicalY - bounds.y) / bounds.height);
        console.log('Normalized coordinates:', normalizedX, normalizedY);
        
        this.currentStroke.points.push({
            x: normalizedX,
            y: normalizedY,
            pressure: (pointer as any).pressure !== undefined ? (pointer as any).pressure : 1
        });
        console.log('DrawQuestion::addPointToStroke:', this.currentStroke.points[this.currentStroke.points.length - 1]);

        this.renderStroke(this.currentStroke, true);
    }

    // Convert normalized coordinates (0-1000) to canvas coordinates
    // Note: this uses this.background to identify canvas size - so this.background must be correctly set before using this function
    private normalizedToCanvasPosition(pos: { x: number, y: number, pressure?: number }): { x: number, y: number, pressure?: number } {
        const canvasWidth = this.background.getBounds().width;
        const canvasHeight = this.background.getBounds().height;

        // Convert from normalized (0-1000) to canvas coordinates
        const canvasX = pos.x * canvasWidth / 1000;
        const canvasY = pos.y * canvasHeight / 1000;

        return { x: canvasX, y: canvasY, pressure: pos.pressure };
    }

    private createNewStroke(): Stroke {
        return {
            points: [],
            color: this.currentColor,
            lineWidth: this.currentLineWidth
        };
    }

    private clearCanvas(): void {
        this.canvas.clear();
        this.drawingData = [];
        this.currentStroke = this.createNewStroke();
        this.isDrawing = false;
    }

    private submitDrawing(): void {
        // Disable drawing after submission
        this.makeNonInteractive();

        // Submit the drawing data as the answer
        console.log('DrawQuestion::submitDrawing:', this.drawingData);
        this.submitAnswer(this.drawingData);

        // Juice - animate the canvas and buttons out
        const tl = gsap.timeline();
		tl.to(this.answerContainer, {
			y: this.scene.getY(2160),
			duration: 0.5,
			ease: 'back.in'
		});
		tl.add(() => {
			this.scene.sound.play('submit-answer');
		}, "<+0.25");
		tl.play();

    }

    // makeInteractive
    // Note that for Draw question there are two levels of interactivity:
    // 1. The ability to zoom/pan the entire canvas when viewing answers
    // 2. The canvas itself for drawing plus the submit button
    // Since we want to keep all question classes consistent, we ALWAYS make step 1 true, and this function applies step 2
    private makeInteractive(): void {

        // SUBMIT button
        this.submitButton.setInteractive({ useHandCursor: true });
        this.submitButton.on('pointerup', () => {
            this.submitDrawing();
        });

        // Add event listeners directly to the background rectangle
        this.background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.isDrawing = true;
            this.currentStroke = this.createNewStroke();
            this.addPointToStroke(pointer);
        });

        this.background.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.isDrawing) {
                this.addPointToStroke(pointer);
            }
        });

        this.background.on('pointerup', () => {
            if (this.isDrawing) {
                this.isDrawing = false;
                if (this.currentStroke.points.length > 1) {
                    // Smooth the points and save the stroke to our drawing data
                    this.currentStroke.points = this.smoothPoints(this.currentStroke.points);
                    this.drawingData.push({
                        points: [...this.currentStroke.points], // copy the points array
                        color: this.currentStroke.color,
                        lineWidth: this.currentStroke.lineWidth
                    });  
                }
                // Experiment with re-drawing entire line which will also smooth it
                this.canvas.clear();
                this.renderDrawingFromData(this.drawingData);
            }
        });

        this.background.on('pointerout', () => {
            if (this.isDrawing) {
                this.isDrawing = false;
                if (this.currentStroke.points.length > 1) {
                    // Save the stroke to our drawing data
                    this.drawingData.push({
                        points: [...this.currentStroke.points],
                        color: this.currentStroke.color,
                        lineWidth: this.currentStroke.lineWidth
                    });
                }
                this.currentStroke = this.createNewStroke();
            }
        });


    }
    private makeNonInteractive(): void {
        this.clearButton.disableInteractive();
        this.submitButton.disableInteractive();
        this.colorButtons.forEach(button => button.disableInteractive());
        this.sizeButtons.forEach(button => button.disableInteractive());

        // Remove all event listeners from the background rectangle
        this.background.removeAllListeners();

    }

    // renderStroke - renders an entire stroke
    // optional isFinal can be passed which would only draw the last segment of the stroke
    // This used when actually live drawing, to append the line segment to current stroke
    private renderStroke(stroke: Stroke, finalSegmentOnly: boolean = false): void {

        console.log('DrawQuestion::renderStroke:', stroke, finalSegmentOnly);

        if (!stroke || stroke.points.length < 2) return;

        const startPointIndex: number = finalSegmentOnly ? stroke.points.length - 2 : 0;

        const firstPoint = stroke.points[startPointIndex];
        const firstCanvasPosition = this.normalizedToCanvasPosition(firstPoint);

        // Add a circle to the beginning of the path to create a rounded line edge
        this.canvas.fillStyle(stroke.color);
        this.canvas.fillCircle(firstCanvasPosition.x, firstCanvasPosition.y, stroke.lineWidth / 2);

        this.canvas.lineStyle(stroke.lineWidth, stroke.color);
        this.canvas.beginPath();
        this.canvas.moveTo(firstCanvasPosition.x, firstCanvasPosition.y);

        // Draw the rest of the points
        for (let i = startPointIndex + 1; i < stroke.points.length; i++) {
            const pt = {
                x: stroke.points[i].x,
                y: stroke.points[i].y
            };
            const currentCanvasPosition = this.normalizedToCanvasPosition(pt);
            this.canvas.lineTo(currentCanvasPosition.x, currentCanvasPosition.y);
        }
        this.canvas.strokePath();

        // Add a circle to the end of the path to create a rounded line edge
        this.canvas.fillStyle(stroke.color);
        const lastPoint = stroke.points[stroke.points.length - 1];
        const lastCanvasPosition = this.normalizedToCanvasPosition(lastPoint);
        this.canvas.fillCircle(lastCanvasPosition.x, lastCanvasPosition.y, stroke.lineWidth / 2);
    }

    // Smooth points by averaging neighboring points to reduce jaggedness, then remove redundant points on straight lines
    private smoothPoints(points: Array<{ x: number; y: number; pressure?: number }>): Array<{ x: number; y: number; pressure?: number }> {
        if (points.length < 3) return points; // No smoothing needed for short strokes

        const smoothed: Array<{ x: number; y: number; pressure?: number }> = [];

        // Optimization: Remove redundant points on straight vertical or horizontal lines
        const optimized: Array<{ x: number; y: number; pressure?: number }> = [];
        optimized.push(points[0]); // Always keep the first point

        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];

            // Keep the point if it's not on a straight line between prev and next
            if ( (prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y) || Math.abs( (curr.x - prev.x) / (next.x - prev.x) - (curr.y - prev.y) / (next.y - prev.y) ) < 0.1) {
                // current point is exactly intermediate point either vertically or horizontally - skip it
            } else {
                optimized.push(curr);
            }
        }
        optimized.push(points[points.length - 1]); // Always keep the last point

        // Keep the first point as-is
        smoothed.push(optimized[0]);

        // Average each middle point with its neighbors
        for (let i = 1; i < optimized.length - 1; i++) {
            const prev = optimized[i - 1];
            const curr = optimized[i];
            const next = optimized[i + 1];

            const avgX = Math.floor((prev.x + curr.x + next.x) / 3);
            const avgY = Math.floor((prev.y + curr.y + next.y) / 3);
            const avgPressure = curr.pressure; // Keep original pressure

            smoothed.push({ x: avgX, y: avgY, pressure: avgPressure });
        }

        // Keep the last point as-is
        smoothed.push(optimized[optimized.length - 1]);

        console.log('DrawQuestion::smoothPoints: original', points.length, 'smoothed', smoothed.length, 'optimized', optimized.length);
        return smoothed;
    }

    private displaySubmittedDrawing(): void {
        // If we have results, show the player's own submission
        console.log('DrawQuestion::displaySubmittedDrawing:', this.questionData.results, this.questionData.sessionId);
        if (this.questionData.results && this.questionData.sessionId) {
            const playerResult = this.questionData.results[this.questionData.sessionId];
            if (playerResult) {
                this.currentStroke = playerResult;
                this.renderStroke(this.currentStroke);
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

    private renderDrawingFromData(drawingData: Stroke[]): void {
        
        if (!Array.isArray(drawingData)) return;

        drawingData.forEach(stroke => {
            this.renderStroke(stroke);
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


