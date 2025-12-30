import { BaseScene } from "./BaseScene";
import MoneyTreeSlot from "./moneytreeslot";

export default class MoneyTreeComponent extends Phaser.GameObjects.Container {
    private slots: MoneyTreeSlot[] = [];
    private slotData: string[] | number[];

    constructor(scene: BaseScene, data: string[] | number[], x: number, startY: number, endY: number) {
        super(scene, x, 0); // Initialize the container at position (x, 0)
        this.slotData = data;

        // Add this container to the scene
        // scene.add.existing(this);

        // Create the tree
        this.createTree(startY, endY);
    }

    private createTree(startY: number, endY: number): void {
        const spacingY = (endY - startY) / (this.slotData.length - 1);

        for (let i = 0; i < this.slotData.length; i++) {
            const slot = new MoneyTreeSlot(this.scene as BaseScene, this.slotData[i]);
            slot.setX(0);
            slot.setY(startY + i * spacingY);
            this.add(slot); // Add the slot directly to this container
            this.slots.push(slot);
        }
    }

    // animateCorrectAnswer
    animateCorrectAnswer(selectedIndex: number, callback: () => void): void {

        console.log('Slots:', this.slots);
        this.slots.map((slot) => { console.log('slot:', slot.state) });

        const availableIndices = this.slots
            .map((slot, i) => ({ slot, i }))
            .filter(({ slot }) => slot.state !== 'revealed')
            .map(({ i }) => i);

        if (availableIndices.length === 0) {
            console.warn("No available slots to animate!");
            return;
        }

        const targetIndex = availableIndices.indexOf(selectedIndex);
        if (targetIndex === -1) {
            console.error("Target index not in available slots!");
            return;
        }

        console.log('Available indices:', availableIndices, 'Target Index:', targetIndex);

        // Now we want to build a journey adding available indices forward and reverse a random number of times
        // Add the random number of times later...
        var journey: number[] = [availableIndices[0]];

        // A random number of times we want to begin from the top
        if (Phaser.Math.Between(1, 100) > 0) {
            journey = availableIndices.slice().reverse();
        }
        for (var i: number = 0; i < Phaser.Math.Between(1, 4); i++) {
            journey = journey.concat(availableIndices.slice(1), availableIndices.slice(0, -1).reverse());
        }
        // And finally add the numbers to get to the desired question index
        if (targetIndex > 0) {
            journey = journey.concat(availableIndices.slice(1, targetIndex), availableIndices[targetIndex]);
        }

        console.log('Journey:', journey);

        const distanceLUT = this.buildDistanceLUT();
        distanceLUT[distanceLUT.length - 1] = 1;
        // console.log('LUT:', distanceLUT);

        var currentSlot: MoneyTreeSlot = this.slots[journey[0]];
        var previousSlot: MoneyTreeSlot = currentSlot;

        this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: journey.length * Phaser.Math.Between(40, 70),
            onUpdate: (tween) => {
                const t = tween.getValue();
                const lutIndex = Math.round(t * (distanceLUT.length - 1));
                const distance = distanceLUT[lutIndex];

                const slotPos = Math.min(Math.round(distance * (journey.length - 1)), journey.length - 1);
                const currentSlot = this.slots[journey[slotPos]];

                if (currentSlot !== previousSlot) {
                    // console.log('t:', t, 'lutIndex:', lutIndex, 'distance:', distance, 'slotPos:', slotPos);
                    this.scene.sound.play('lowtick', { volume: 0.5 })
                    currentSlot.highlightSlot();
                    previousSlot.unhighlightSlot();
                    previousSlot = currentSlot;
                }
            },
            onComplete: () => {
                console.log('onComplete: adding tween chain:', this.scene.time.timeScale, this.scene.tweens, this.slots, this.slots[selectedIndex]);
                this.scene.sound.play('highlightslot');
                const chain: Phaser.Tweens.TweenChain = this.scene.tweens.chain({
                    targets: this.slots[selectedIndex],
                    tweens: [
                        {
                            scale: 1,
                            duration: 200,
                            onComplete: () => { this.slots[selectedIndex].unhighlightSlot() }
                        },
                        {
                            scale: 1,
                            duration: 70,
                            onComplete: () => { this.slots[selectedIndex].highlightSlot() }
                        }
                    ],
                    repeat: 4,
                    onComplete: () => {
                        console.log('chain onComplete...:', chain.timeScale, this.scene.time.timeScale);
                        callback();
                    }
                });
            }

        });

    }

    // Speed decay curve: starts fast, then slows to 0 - power randomised between 1.2 - 2
    speedCurve(t: number): number {
        return Math.pow(1 - t, Phaser.Math.Between(15, 25) / 10); // fast at start, slows over time
    }
    buildDistanceLUT(steps = 1000): number[] {
        const lut = [];
        let cumulative = 0;
        let total = 0;

        // First calculate the total area under the curve (for normalization)
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            total += this.speedCurve(t);
        }

        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            cumulative += this.speedCurve(t);
            lut.push(cumulative / total); // Normalized distance at time t
        }

        return lut;
    }


    public getEmptySlots(): MoneyTreeSlot[] {
        return this.slots.filter((slot) => slot.state === 'empty');
    }

    public getSlotIndex(slot: MoneyTreeSlot): number {
        return this.slots.indexOf(slot);
    }

    public getSlotByIndex(index: number): MoneyTreeSlot {
        return this.slots[index];
    }

    public updateSlots(backgroundColor: string, textColor: string, borderColor: string): void {
        for (const slot of this.slots) {
            slot.setBackgroundColor(backgroundColor);
            slot.setTextColor(textColor);
            slot.setBorderColor(borderColor);
        }
    }

    public getSlotData(): string[] | number[] {
        return this.slotData;
    }
    public getAllSlots(): MoneyTreeSlot[] {
        return this.slots;
    }

    public updateSlot(index: number, backgroundColor: string, textColor: string, borderColor: string): void {
        const slot = this.slots[index];
        slot.setBackgroundColor(backgroundColor);
        slot.setTextColor(textColor);
        slot.setBorderColor(borderColor);
    }

    public setSlotState(index: number, state: string): void {
        const slot = this.slots[index];
        slot.setSlotState(state);
    }

    public setSlotText(index: number, text: string): void {
        const slot = this.slots[index];
        slot.setText(text);
    }

    public destroy(): void {
        super.destroy(true); // Destroy the container and all its children
    }
}