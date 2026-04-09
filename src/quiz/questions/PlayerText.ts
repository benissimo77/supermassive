import { BaseScene } from "src/BaseScene";
import { PlayerBaseQuestion } from "./PlayerBaseQuestion";
import { TextQuestionData } from "./QuestionTypes";

export default class PlayerTextQuestion extends PlayerBaseQuestion {

    private htmlInput: HTMLInputElement;
    private htmlSubmitButton: HTMLButtonElement;

    constructor(scene: BaseScene, questionData: TextQuestionData) {
        super(scene, questionData);
    }

    protected createAnswerUI(): void {
        console.log('PlayerTextQuestion::createAnswerUI (NATIVE HTML BYPASS)');

        // Create a root UI layer if it doesn't exist, completely outside Phaser's canvas and DOM manager
        let uiLayer = document.getElementById('native-ui-layer');
        if (!uiLayer) {
            uiLayer = document.createElement('div');
            uiLayer.id = 'native-ui-layer';
            Object.assign(uiLayer.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none', // Let touches pass through to Phaser canvas by default
                zIndex: '9999' // Topmost layer
            });
            document.body.appendChild(uiLayer);
        }

        // Bypassing Phaser DOM element layer entirely just for text input fields.
        this.htmlInput = document.createElement('input');
        this.htmlInput.type = 'text';
        this.htmlInput.maxLength = 20;
        this.htmlInput.id = 'nativeAnswerInput';
        this.htmlInput.placeholder = 'Type your answer...';
        this.htmlInput.autocomplete = 'off';
        
        // Let it size relatively using vw/vh so it looks okay on mobile/desktop without JS math
        Object.assign(this.htmlInput.style, {
            position: 'absolute',
            left: '50%',
            top: '5%', // HARD PINNED TO TOP to avoid keyboard collision logic!
            transform: 'translate(-50%, 0)',
            width: '80vw',
            maxWidth: '600px',
            height: '60px',
            fontSize: '24px', // Responsive text
            textAlign: 'center',
            borderRadius: '15px',
            border: '4px solid rgb(255, 215, 0)', // Gold outline
            padding: '10px',
            backgroundColor: '#002266', // Navy blue
            color: '#fff',
            boxShadow: 'inset 0 0 10px #000, 0 0 8px rgba(255, 215, 0, 0.5)',
            fontFamily: '"Titan One", Arial',
            pointerEvents: 'auto', // Catch touches!
            userSelect: 'auto', // Override body's user-select: none
            WebkitUserSelect: 'auto', // Crucial for iOS Safari!!!
            touchAction: 'auto', // Reverse canvas touch-action: none so keyboard works
            transition: 'transform 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)', // Smooth animations
            opacity: '1'
        });
        
        // This hints the mobile keyboard to visually change "Return" to "Send" or "Go"
        this.htmlInput.setAttribute('enterkeyhint', 'submit');

        uiLayer.appendChild(this.htmlInput);

        // --- ISOLATE FROM PHASER ---
        // Stop the events from bubbling down to document body where Phaser stops them
        const stopProp = (e: Event) => {
            // ONLY stop propagation so Phaser doesn't catch it and run preventDefault.
            // DO NOT call preventDefault yourself.
            // DO NOT call focus() programmatically here, let the browser do it naturally.
            e.stopPropagation();
        };

        this.htmlInput.addEventListener('touchstart', stopProp, { passive: false });
        this.htmlInput.addEventListener('touchend', stopProp, { passive: false });
        this.htmlInput.addEventListener('touchmove', stopProp, { passive: false });
        this.htmlInput.addEventListener('mousedown', stopProp);
        this.htmlInput.addEventListener('mouseup', stopProp);
        this.htmlInput.addEventListener('click', stopProp);

        // Submit via "Enter" key on mobile/desktop keyboard
        this.htmlInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.handleSubmit();
            }
        });

        // Add a perfectly styled HTML submit button to replace the Phaser one
        this.htmlSubmitButton = document.createElement('button');
        this.htmlSubmitButton.innerText = 'SUBMIT';
        Object.assign(this.htmlSubmitButton.style, {
            position: 'absolute',
            left: '50%',
            top: 'calc(5% + 75px)', // Tucked nicely beneath the input
            transform: 'translate(-50%, 0)',
            width: '200px',
            height: '45px',
            fontSize: '18px',
            textAlign: 'center',
            borderRadius: '12px',
            border: '2px solid rgb(230, 150, 20)', // Softer, matte orange-gold to match Phaser button body
            backgroundColor: '#002266', // Navy blue
            color: '#fff',
            fontFamily: '"Titan One", Arial',
            pointerEvents: 'auto',
            cursor: 'pointer',
            transition: 'transform 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
            userSelect: 'none',
            WebkitUserSelect: 'none'
        });

        // Stop propagation so Phaser doesn't eat the taps
        this.htmlSubmitButton.addEventListener('touchstart', stopProp, { passive: false });
        this.htmlSubmitButton.addEventListener('touchend', stopProp, { passive: false });
        this.htmlSubmitButton.addEventListener('mousedown', stopProp);
        this.htmlSubmitButton.addEventListener('mouseup', stopProp);
        this.htmlSubmitButton.addEventListener('click', stopProp);

        uiLayer.appendChild(this.htmlSubmitButton);

        this.makeInteractive();
    }

    protected showAnswerContent(answerHeight: number): void {
        // Prevent layout shifts while typing
        if (document.activeElement === this.htmlInput) {
            return;
        }
        
        // We're letting the UI layer CSS natively manage the positions
    }

    protected makeInteractive(): void {
        this.htmlSubmitButton.addEventListener('click', () => {
            this.handleSubmit();
        });
        
        // Ensure touch interfaces don't delay the tap
        this.htmlSubmitButton.addEventListener('touchend', (e) => {
            e.preventDefault(); // Fast fluid click
            this.handleSubmit();
        });
    }

    private handleSubmit(): void {
        if (!this.htmlInput) return;
        
        const val = this.htmlInput.value.trim();
        console.log('PlayerTextQuestion submitting:', val);
        
        if (val !== "") {
            this.makeNonInteractive();
            // Retract the keyboard immediately
            this.htmlInput.blur();
            
            // Submit immediately so host updates instantly
            this.submitAnswer(val); 


            // 2) Wait for keyboard to vanish (approx 400ms), then Input Field glides off the TOP
            this.scene.time.delayedCall(800, () => {
                if (this.htmlInput) {
                    this.htmlInput.style.transform = 'translate(-50%, -100vh)';
                }
                if (this.htmlSubmitButton) {
                    this.htmlSubmitButton.style.transform = 'translate(-50%, -100vh)';
                }
            });
        }
    }

    protected makeNonInteractive(): void {
        if (this.htmlInput) {
            this.htmlInput.disabled = true;
            this.htmlInput.style.pointerEvents = 'none';
            // Provide visual cue it's locked, but don't grey it out completely
            this.htmlInput.style.border = '4px solid #00ff00'; // Green lock-in outline
        }
        if (this.htmlSubmitButton) {
            this.htmlSubmitButton.disabled = true;
            this.htmlSubmitButton.style.pointerEvents = 'none';
        }
    }

    public destroy(fromScene?: boolean): void {
        if (this.htmlInput && this.htmlInput.parentNode) {
            this.htmlInput.parentNode.removeChild(this.htmlInput);
        }

        if (this.htmlSubmitButton && this.htmlSubmitButton.parentNode) {
            this.htmlSubmitButton.parentNode.removeChild(this.htmlSubmitButton);
        }
        
        let uiLayer = document.getElementById('native-ui-layer');
        if (uiLayer && uiLayer.childNodes.length === 0) {
            uiLayer.parentNode?.removeChild(uiLayer);
        }

        super.destroy(fromScene);
    }
}
