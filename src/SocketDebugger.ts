import { BaseScene } from "./BaseScene";

/**
 * Debug panel for simulating socket events in QuizHostScene
 * This allows testing state transitions without needing actual socket connections
 */
export class SocketDebugger {
    private scene: BaseScene;
    private container: Phaser.GameObjects.Container;
    private background: Phaser.GameObjects.Rectangle;
    private buttons: Phaser.GameObjects.Container[] = [];
    private isVisible: boolean = false;
    private toggleButton: Phaser.GameObjects.Container;
    private socket: any; // Socket.io socket instance

    // Modal elements
    private modalContainer: Phaser.GameObjects.Container;
    private modalInput: any; // Will hold the DOM element
    private currentEvent: { event: string, payload: any } | null = null;

    // Position
    private posY: number = 120;

    // Configuration for each debug event
    private debugEvents: { event: string; label: string; payload: any }[] = [
        // Connection events
        {
            event: 'server:players', label: 'Host Connect', payload: [
                { name: 'Player One', avatar: '12138743', socketID: '1', sessionID: '1' },
                { name: 'Player Two', avatar: '12140600', socketID: '2', sessionID: '2' },
                { name: 'Player Three', avatar: '12140600', socketID: '3', sessionID: '3' },
                { name: 'Player Four', avatar: '12138743', socketID: '4', sessionID: '4' },
                { name: 'Player Five', avatar: '12138743', socketID: '5', sessionID: '5' }

            ]
        },
        {
            event: 'playerconnect', label: 'Add Player', payload: { name: 'New Player', avatar: '12140600', socketID: '4', sessionID: "X4" }
        },
        {
            event: 'playerdisconnect', label: 'Remove Player', payload: {
                socketID: '3'
            }
        },

        // Quiz flow events
        {
            event: 'server:introquiz', label: 'Intro Quiz', payload: {
                "title": "Test Quiz",
                "description": "This is a test quiz triggered from the debug panel"
            }
        },
        {
            event: 'server:introround', label: 'Intro Round', payload: {
                title: 'Test Round',
                description: 'This is a test round triggered from the debug panel'
            }
        },
        {
            event: 'server:question', label: 'Test Question', payload: {
                "type": "multiple-choice",
                "id": "q1",
                "text": "What is the capital of France?",
                "image": null,
                "audio": null,
                "video": null,
                "options": ["Paris", "London", "Berlin", "Madrid"],
                "answer": "Paris"
            }
        },
        {
            event: 'server:questionanswered', label: 'Player Answer', payload: {
                playerId: "1",
                answer: "Paris"
            }
        },
        {
            event: 'server:showanswer', label: 'Show Answer', payload: {
                id: "q1",
                answer: "Paris",
                stats: {
                    "Paris": 2,
                    "London": 1,
                    "Berlin": 0,
                    "Madrid": 0
                }
            }
        },
        {
            event: 'server:updatescores', label: 'Update Scores', payload: {
                scores: { "1": 10, "2": 5, "3": 0, "4": 0 }
            }
        },
        { event: 'server:endquestion', label: 'End Question', payload: {} },
        { event: 'server:endround', label: 'End Round', payload: {} },
        { event: 'server:endquiz', label: 'End Quiz', payload: { "quizTitle": "Test Title", "scores": { "1":21, "2":28, "3":31, "4":32, "5":35 } } },

        // Timer event
        { event: 'server:starttimer', label: 'Start Timer', payload: { duration: 10 } },
    ];

    constructor(scene: BaseScene, socket: any) {
        this.scene = scene;
        this.socket = socket;
        this.createDebugPanel();
    }

    /**
 * Creates a standardized button with consistent styling
 * @param x - X position
 * @param y - Y position 
 * @param text - Button text
 * @param callback - Function to call when clicked
 * @param options - Optional customizations
 */

    private createButton(
        x: number,
        y: number,
        text: string,
        callback: () => void,
        options: {
            width?: number;
            height?: number;
            backgroundColor?: number;
            isSmall?: boolean;
        } = {}
    ): Phaser.GameObjects.Container {
        // Set defaults with minimal options
        const width = options.width || 150;
        const height = options.height || (options.isSmall ? 30 : 50);
        const backgroundColor = options.backgroundColor || 0x3366cc;
        const fontSize = options.isSmall ? '14px' : '18px';

        const buttonContainer = this.scene.add.container(x, y);

        // Button background
        const buttonBg = this.scene.add.rectangle(
            0, 0, width, height, backgroundColor, 1
        ).setOrigin(options.isSmall ? 0 : 0.5, options.isSmall ? 0 : 0.5);

        // Button text
        const buttonText = this.scene.add.text(
            options.isSmall ? width / 2 : 0,
            options.isSmall ? height / 2 : 0,
            text,
            {
                fontSize: fontSize,
                fontFamily: 'Arial',
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5, 0.5);

        // Add to container
        buttonContainer.add(buttonBg);
        buttonContainer.add(buttonText);

        // Make interactive
        const hoverColor = 0x5588ee;
        const pressColor = 0x225599;

        buttonBg.setInteractive({ useHandCursor: true })
            .on('pointerover', () => buttonBg.setFillStyle(hoverColor))
            .on('pointerout', () => buttonBg.setFillStyle(backgroundColor))
            .on('pointerdown', () => buttonBg.setFillStyle(pressColor))
            .on('pointerup', () => {
                buttonBg.setFillStyle(backgroundColor);
                callback();
            });

        return buttonContainer;
    }

    /**
     * Create the debug panel UI
     */
    private createDebugPanel(): void {
        // Create main container
        this.container = this.scene.add.container(10, this.posY);
        this.container.setDepth(1000); // Make sure it's on top of everything

        // Create background panel
        this.background = this.scene.add.rectangle(
            0, 0, 200, 600, 0x000000, 0.7
        );
        this.background.setOrigin(0, 0);
        this.container.add(this.background);

        // Create title
        const title = this.scene.add.text(
            100, 20, 'SOCKET DEBUG',
            {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5, 0);
        this.container.add(title);

        // Create debug buttons
        this.createDebugButtons();

        // Create toggle button (always visible)
        this.createToggleButton();

        // Initially hide the panel
        this.container.setVisible(false);
        this.isVisible = false;

        // ...and now show it
        this.toggleVisibility();

        // Add modal container for payload editing
        this.createModalDialog();
    }

    /**
     * Create the debug event buttons
     */
    private createDebugButtons(): void {
        const buttonWidth = 180;
        const buttonHeight = 30;
        const buttonSpacing = 5;
        let yPosition = 50;

        // Create a button for each debug event
        this.debugEvents.forEach((debugEvent, index) => {
            // Create button container
            const buttonContainer = this.scene.add.container(10, yPosition);

            const mainButton = this.createButton(0, 0, debugEvent.label,
                () => this.emitSocketEvent(debugEvent.event, debugEvent.payload),
                {
                    width: buttonWidth - 30,
                    height: buttonHeight,
                    isSmall: true,
                    backgroundColor: 0x3366cc
                }
            );

            // Edit button 
            const editButton = this.createButton(buttonWidth - 30, 0, '✏️',
                () => this.showEditModal(debugEvent.event, debugEvent.payload),
                {
                    width: 30,
                    height: buttonHeight,
                    isSmall: true,
                    backgroundColor: 0x996633
                }
            );

            buttonContainer.add(mainButton);
            buttonContainer.add(editButton);

            // Add to main container
            this.container.add(buttonContainer);
            this.buttons.push(buttonContainer);

            // Update y position for next button
            yPosition += buttonHeight + buttonSpacing;
        });

        // Update background height to fit all buttons
        this.background.height = yPosition + 10;
    }


    /**
     * Create the toggle button to show/hide the debug panel
     */
    private createToggleButton(): void {
        this.toggleButton = this.createButton(10, this.posY, 'D',
            () => this.toggleVisibility(),
            {
                width: 40,
                height: 40,
                backgroundColor: 0xcc3333
            }
        );
        this.toggleButton.setDepth(1001);
    }

    private createModalDialog(): void {
        // Create container for the modal
        this.modalContainer = this.scene.add.container(800, 0);
        this.modalContainer.setDepth(1100); // Above everything

        // Dialog background
        const dialogBg = this.scene.add.rectangle(
            0, 0, 800, 480, 0x333333, 0.95
        );
        dialogBg.setOrigin(0.5, 0);
        dialogBg.setStrokeStyle(2, 0xffffff);

        // Title
        const title = this.scene.add.text(
            0, 10, 'EDIT PAYLOAD',
            {
                fontSize: '24px',
                fontFamily: 'Arial',
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5, 0);

        // Create an HTML textarea for editing
        const inputElement = document.createElement('textarea');
        inputElement.style.width = '700px';
        inputElement.style.height = '300px';
        inputElement.style.padding = '10px';
        inputElement.style.fontSize = '18px';
        inputElement.style.fontFamily = 'monospace';
        inputElement.style.color = '#ffffff';
        inputElement.style.backgroundColor = '#222222';
        inputElement.style.border = '1px solid #555555';
        inputElement.style.borderRadius = '4px';

        // Add the DOM element to the scene
        this.modalInput = this.scene.add.dom(0, 40, inputElement);
        this.modalInput.setOrigin(0.5, 0);

        // Create buttons
        const sendButton = this.createButton(-240, 400, 'SEND', () => this.sendEditedPayload());
        const cancelButton = this.createButton(240, 400, 'CANCEL', () => this.closeModal());

        // Add everything to the container
        this.modalContainer.add(dialogBg);
        this.modalContainer.add(title);
        this.modalContainer.add(this.modalInput);
        this.modalContainer.add(sendButton);
        this.modalContainer.add(cancelButton);

        // Hide the modal initially
        this.modalContainer.setVisible(false);
    }

    private showEditModal(event: string, payload: any): void {
        // Store current event
        this.currentEvent = { event, payload };

        // Format the JSON with indentation for readability
        const formattedJson = JSON.stringify(payload, null, 2);

        // Set the value in the textarea
        (this.modalInput.node as HTMLTextAreaElement).value = formattedJson;

        // Show the modal
        this.modalContainer.setVisible(true);
    }

    private closeModal(): void {
        this.modalContainer.setVisible(false);
        this.currentEvent = null;
    }

    private sendEditedPayload(): void {
        if (!this.currentEvent) return;

        try {
            // Get the edited JSON from the textarea
            const editedJson = (this.modalInput.node as HTMLTextAreaElement).value;
            const editedPayload = JSON.parse(editedJson);

            // Emit the event with the edited payload
            this.emitSocketEvent(this.currentEvent.event, editedPayload);

            // Close the modal
            // this.closeModal();

        } catch (error) {
            console.error('Error:', error);

            // Show error message
            const currentText = (this.modalInput.node as HTMLTextAreaElement).value;
            (this.modalInput.node as HTMLTextAreaElement).value =
                "ERROR:\n\n" + currentText;
        }
    }



    /**
     * Toggle debug panel visibility
     */
    private toggleVisibility(): void {
        this.isVisible = !this.isVisible;
        this.container.setVisible(this.isVisible);

        // Move toggle button when panel is visible
        if (this.isVisible) {
            this.toggleButton.setPosition(220, this.posY);
        } else {
            this.toggleButton.setPosition(10, this.posY);
        }
    }

    /**
     * Emit a socket event with the given payload
     */
    private emitSocketEvent(event: string, payload: any): void {
        console.log(`[SocketDebugger] Emitting event: ${event}`, payload);

        // For server-to-client events, we need to simulate them differently
        if (event.startsWith('server:') || event === 'hostconnect' || event === 'playerconnect' || event === 'playerdisconnect') {
            // Get the socket.io client instance and invoke its event handlers directly
            // This simulates receiving an event from the server
            const socketInstance = this.socket;

            if (socketInstance && socketInstance.onevent) {
                // This directly calls the event handlers as if the event was received
                socketInstance.onevent({
                    data: [event, payload]
                });
            }

            // Log the simulated event
            console.log(`[SocketDebugger] Simulated incoming event: ${event}`);
        } else {
            // For client-to-server events, we can simply emit them
            this.socket.emit(event, payload);
        }
    }

    /**
     * Add a custom debug event
     */
    addCustomEvent(event: string, label: string, payload: any): void {
        this.debugEvents.push({ event, label, payload });
        // Rebuild buttons if already created
        if (this.container) {
            this.buttons.forEach(button => button.destroy());
            this.buttons = [];
            this.createDebugButtons();
        }
    }
}