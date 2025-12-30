import MoneyTreeState from "./MoneyTreeState";

export default class FSM {

    private state: MoneyTreeState;
    private transitions: Record<MoneyTreeState, MoneyTreeState[]>;
    private stateActions: Record<MoneyTreeState, () => void>;
    private persistentCallbacks: Array<(newState: MoneyTreeState, oldState: MoneyTreeState) => void> = [];
    private singleUseCallbacks: Array<(newState: MoneyTreeState, oldState: MoneyTreeState) => void> = [];


    constructor(
        initialState: MoneyTreeState,
        transitions: Record<MoneyTreeState, MoneyTreeState[]>,
        stateActions: Record<MoneyTreeState, () => void>
    ) {
        this.state = initialState;
        this.transitions = transitions;
        this.stateActions = stateActions;
    }

    start(): void {
        console.log(`Starting FSM in state: ${this.state}`);
        this.handleStateChange(this.state);
    }

    // nextStaste - can be called at any time to simply move to the next state
    nextState(): void {
        const nextStates = this.transitions[this.state];
        if (nextStates.length > 0) {
            const newState = nextStates[0]; // Get the first available state to transition to
            this.transitionTo(newState);
        } else {
            throw new Error(`No available transitions from ${this.state}`);
        }
    }

    canTransitionTo(newState: MoneyTreeState): boolean {
        return this.transitions[this.state]?.includes(newState) ?? false;
    }


    transitionTo(newState: MoneyTreeState): void {
        console.log(`Transitioning from ${this.state} to ${newState}`);
        if (this.canTransitionTo(newState)) {
            this.forceTransitionTo(newState);
        } else {
            throw new Error(`Invalid transition from ${this.state} to ${newState}`);
        }
    }

    forceTransitionTo(newState: MoneyTreeState): void {
        const oldState = this.state;
        this.state = newState;

        // Notify all persistent callbacks
        this.persistentCallbacks.forEach(callback => callback(newState, oldState));

        // Notify and remove single-use callbacks
        this.singleUseCallbacks.forEach(callback => callback(newState, oldState));
        this.singleUseCallbacks = []; // Clear single-use callbacks after invocation

        // Handle the state change action
        this.handleStateChange(newState);

    }

    // Register a persistent callback for state changes
    onStateChange(callback: (newState: MoneyTreeState, oldState: MoneyTreeState) => void): void {
        this.persistentCallbacks.push(callback);
    }

    // Register a single-use callback for the next state change
    onNextStateChange(callback: (newState: MoneyTreeState, oldState: MoneyTreeState) => void): void {
        this.singleUseCallbacks.push(callback);
    }


    // Transition:
    handleStateChange(newState: MoneyTreeState): void {
        const action = this.stateActions[newState];
        if (action) action();
    }

    // return the current state of the FSM
    getState(): MoneyTreeState {
        return this.state;
    }
    // return all available states - used by the debugger panel
    getAllStates(): MoneyTreeState[] {
        return Object.keys(this.stateActions) as MoneyTreeState[];
    }
}

