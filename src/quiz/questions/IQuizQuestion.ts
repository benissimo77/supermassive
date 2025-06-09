export interface IQuizQuestion {
    display(): void;
    update(time: number, delta: number): void;
    showAnswer(questionData: any): void;
    updatePlayerAnswer(playerId: string, answer: any): void;
    destroy(): void;
}
