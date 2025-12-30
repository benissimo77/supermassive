// A Phaser-integrated State Debugger Panel for FSM-based games
import FSM from './fsm'
import MoneyTreeState from './MoneyTreeState';

export class StateDebuggerPanel {
    private scene: Phaser.Scene;
    private fsm: FSM;
    private mockStateCallback: { (state: MoneyTreeState): void }
    private container: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene, fsm: FSM, mockStateCallback: { (state: MoneyTreeState): void }) {
        this.scene = scene;
        this.fsm = fsm;
        this.mockStateCallback = mockStateCallback
        this.buildUI();
    }

    buildUI(): void {

        this.container = this.scene.add.container(10, 10).setDepth(9999);
        const panelBackground = this.scene.add.rectangle(0, 0, 200, 300, 0x000000, 0.7)
            .setOrigin(0)
            .setScrollFactor(0);
        this.container.add(panelBackground);

        const states = this.fsm.getAllStates();
        let yOffset = 10;

        states.forEach((state: MoneyTreeState) => {
            const button = this.scene.add.text(10, yOffset, state, {
                font: '16px monospace',
                color: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 5, y: 5 }
            })
                .setData('name', state)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0);

            button.on('pointerdown', () => {
                this.transitionTo(state);
            });

            this.container.add(button);
            yOffset += 30; // Adjust spacing between buttons

        });

        this.fsm.onStateChange((newState: MoneyTreeState) => this.showState(newState));
        this.hide();
    }

    showState(newState: MoneyTreeState): void {
        console.log('StateDebugger: showState:', newState);
        this.container.getAll().forEach((item) => {
            if (item instanceof Phaser.GameObjects.Text) {
                const isActive = item.getData('name') === newState;
                item.setStyle({ backgroundColor: isActive ? '#666666' : '#333333' });
            }
        });
    }

    transitionTo(state: MoneyTreeState) {

        console.log(`Debug: Forcing transition to state: ${state}`);
        this.mockStateCallback(state);
        this.fsm.forceTransitionTo(state);
    }

    show() {
        this.container.setVisible(true);
    }

    hide() {
        this.container.setVisible(false);
    }

    toggle() {
        this.container.setVisible(!this.container.visible);
    }
}
