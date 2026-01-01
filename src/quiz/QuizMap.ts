import { BaseScene } from "src/BaseScene";

export interface QuizMapData {
    title: string;
    questionCount: number;
    showAnswer: 'question' | 'round';
    updateScores: 'question' | 'round';
}

export class QuizMap extends Phaser.GameObjects.Container {
    private quizMapData: QuizMapData[] = [];
    private currentRound: number = -1;
    private currentQuestion: number = -1;
    private currentState: string = '';
    private graphics: Phaser.GameObjects.Graphics;
    private roundCircles: Phaser.GameObjects.Arc[] = [];
    private questionCircles: Phaser.GameObjects.Arc[][] = [];
    private roundTexts: Phaser.GameObjects.Text[] = [];
    private questionTexts: Phaser.GameObjects.Text[][] = [];
    private phaseTexts: Phaser.GameObjects.Text[] = [];

    // New phase icons
    private answerIcons: (Phaser.GameObjects.Rectangle | null)[][] = [];
    private scoreIcons: (Phaser.GameObjects.Rectangle | null)[][] = [];
    private roundEndAnswerIcons: (Phaser.GameObjects.Rectangle | null)[] = [];
    private roundEndScoreIcons: (Phaser.GameObjects.Rectangle | null)[] = [];
    private trophyIcon: Phaser.GameObjects.Text | null = null;
    private trophyTween: Phaser.Tweens.Tween | null = null;
    private trophyShineTween: Phaser.Tweens.Tween | null = null;

    constructor(scene: BaseScene, x: number, y: number) {
        super(scene, x, y);
        this.graphics = scene.add.graphics();
        this.add(this.graphics);
    }

    public setMapData(data: QuizMapData[]): void {
        this.quizMapData = data;
        this.createMap();
    }

    public updatePosition(round: number, question: number, state: string = ''): void {
        this.currentRound = round - 1; // Convert to 0-indexed
        this.currentQuestion = question - 1; // Convert to 0-indexed
        this.currentState = state;
        this.createMap();
    }

    private createMap(): void {
        // Clear existing
        this.roundCircles.forEach(c => c.destroy());
        this.questionCircles.forEach(row => row.forEach(c => c.destroy()));
        this.roundTexts.forEach(t => t.destroy());
        this.questionTexts.forEach(row => row.forEach(t => t.destroy()));
        this.phaseTexts.forEach(t => t.destroy());
        this.answerIcons.forEach(row => row.forEach(i => i?.destroy()));
        this.scoreIcons.forEach(row => row.forEach(i => i?.destroy()));
        this.roundEndAnswerIcons.forEach(i => i?.destroy());
        this.roundEndScoreIcons.forEach(i => i?.destroy());
        if (this.trophyIcon) {
            this.trophyIcon.destroy();
            this.trophyIcon = null;
        }
        // Stop trophy tweens if they exist
        if (this.trophyTween) {
            this.trophyTween.stop();
            this.trophyTween = null;
        }
        if (this.trophyShineTween) {
            this.trophyShineTween.stop();
            this.trophyShineTween = null;
        }
        
        this.roundCircles = [];
        this.questionCircles = [];
        this.roundTexts = [];
        this.questionTexts = [];
        this.phaseTexts = [];
        this.answerIcons = [];
        this.scoreIcons = [];
        this.roundEndAnswerIcons = [];
        this.roundEndScoreIcons = [];

        const gap = 12; // Slightly larger gap for better spacing
        const roundRadius = 35;
        const questionRadius = 20;
        const phaseSize = 32; // Slightly larger
        const baseY = -30; // Nudge up slightly
        const strokeWidth = 6;

        let currentX = 0; // This will track the right edge of the last drawn element

        // Determine which round to expand. 
        // If we haven't started (-1), don't expand any rounds.
        // If we are at the end, expand the last round.
        const isIntroQuiz = this.currentRound < 0 || this.currentState === 'INTRO_QUIZ';
        const activeRoundIndex = isIntroQuiz ? -1 : (this.currentRound >= this.quizMapData.length ? this.quizMapData.length - 1 : this.currentRound);
        const isEndQuiz = this.currentState === 'END_QUIZ';

        this.quizMapData.forEach((round, rIndex) => {
            const isPastRound = rIndex < this.currentRound;
            const isCurrentRound = rIndex === this.currentRound;
            // At the end of the quiz, we still want to see the last round expanded to show the trophy at the end of it
            const isExpanded = (rIndex === activeRoundIndex);

            const currentRoundRadius = roundRadius;

            if (rIndex > 0) {
                currentX += gap;
            }

            const centerX = currentX + currentRoundRadius;

            // --- Draw Round Circle ---
            let roundColor = 0x666666;
            let roundStroke = 0x888888;
            let roundTextColor = '#ffffff';

            if (isCurrentRound) {
                roundColor = 0x00ff00;
                roundStroke = 0xffffff;
                roundTextColor = '#000000';
            } else if (isPastRound) {
                roundColor = 0x008800;
                roundStroke = 0xaaaaaa;
            }

            const roundCircle = this.scene.add.arc(centerX, baseY, currentRoundRadius, 0, 360, false, roundColor);
            roundCircle.setStrokeStyle(strokeWidth, roundStroke);
            this.add(roundCircle);
            this.roundCircles.push(roundCircle);

            const roundText = this.scene.add.text(centerX, baseY, (rIndex + 1).toString(), {
                fontSize: '24px',
                color: roundTextColor,
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.add(roundText);
            this.roundTexts.push(roundText);

            currentX += currentRoundRadius * 2;

            const questionsInThisRound: Phaser.GameObjects.Arc[] = [];
            const textsInThisRound: Phaser.GameObjects.Text[] = [];
            const answersInThisRound: (Phaser.GameObjects.Rectangle | null)[] = [];
            const scoresInThisRound: (Phaser.GameObjects.Rectangle | null)[] = [];
            
            if (isExpanded) {
                // Draw question circles for this round
                for (let qIndex = 0; qIndex < round.questionCount; qIndex++) {
                    const isPastQuestion = qIndex < this.currentQuestion;
                    const isCurrentQuestion = qIndex === this.currentQuestion;

                    currentX += gap;
                    const qCenterX = currentX + questionRadius;

                    let qColor = 0x444444;
                    let qStroke = 0x888888;
                    let qRadius = questionRadius;
                    let qTextColor = '#ffffff';

                    if (isCurrentQuestion) {
                        qColor = 0xffff00;
                        qStroke = 0xffffff;
                        qRadius = 24;
                        qTextColor = '#000000';
                    } else if (isPastQuestion) {
                        qColor = 0x888800;
                        qStroke = 0xaaaaaa;
                    }

                    const qCircle = this.scene.add.arc(qCenterX, baseY, qRadius, 0, 360, false, qColor);
                    qCircle.setStrokeStyle(strokeWidth, qStroke);
                    this.add(qCircle);
                    questionsInThisRound.push(qCircle);

                    const qText = this.scene.add.text(qCenterX, baseY, (qIndex + 1).toString(), {
                        fontSize: isCurrentQuestion ? '18px' : '14px',
                        color: qTextColor,
                        fontFamily: 'Arial'
                    }).setOrigin(0.5);
                    this.add(qText);
                    textsInThisRound.push(qText);

                    currentX += questionRadius * 2;

                    // Check if we should merge Answer and Score icons
                    const mergeIcons = round.showAnswer === 'question' && round.updateScores === 'question';

                    if (mergeIcons) {
                        currentX += gap;
                        const iconCenterX = currentX + (phaseSize / 2);
                        
                        const isAnswering = isCurrentQuestion && this.currentState === 'SHOW_ANSWER';
                        const isScoring = isCurrentQuestion && this.currentState === 'UPDATE_SCORES';
                        const isDone = isPastQuestion || (isCurrentQuestion && (this.currentState === 'NEXT_QUESTION' || this.currentState === 'END_ROUND'));
                        
                        let iconColor = 0x444444;
                        let iconStroke = 0x888888;
                        let iconTextColor = '#ffffff';

                        if (isAnswering) {
                            iconColor = 0x00ffff;
                            iconStroke = 0xffffff;
                            iconTextColor = '#000000';
                        } else if (isScoring) {
                            iconColor = 0xff00ff;
                            iconStroke = 0xffffff;
                            iconTextColor = '#000000';
                        } else if (isDone) {
                            iconColor = 0x440044; // Dark purple for "both done"
                            iconStroke = 0xaaaaaa;
                        }

                        const rect = this.scene.add.rectangle(iconCenterX, baseY, phaseSize, phaseSize, iconColor);
                        rect.setStrokeStyle(4, iconStroke);
                        this.add(rect);
                        answersInThisRound.push(rect);
                        scoresInThisRound.push(rect); // Both point to same rect
                        
                        const t = this.scene.add.text(iconCenterX, baseY, 'A$', { fontSize: '14px', color: iconTextColor, fontStyle: 'bold' }).setOrigin(0.5);
                        this.add(t);
                        this.phaseTexts.push(t);
                        
                        currentX += phaseSize;
                    } else {
                        // Per-question Answer icon
                        if (round.showAnswer === 'question') {
                            currentX += gap;
                            const iconCenterX = currentX + (phaseSize / 2);
                            
                            const isAnswering = isCurrentQuestion && this.currentState === 'SHOW_ANSWER';
                            const isAnswered = isPastQuestion || (isCurrentQuestion && (this.currentState === 'UPDATE_SCORES' || this.currentState === 'NEXT_QUESTION' || this.currentState === 'END_ROUND'));
                            
                            let aColor = 0x444444;
                            let aStroke = 0x888888;
                            let aTextColor = '#ffffff';

                            if (isAnswering) {
                                aColor = 0x00ffff;
                                aStroke = 0xffffff;
                                aTextColor = '#000000';
                            } else if (isAnswered) {
                                aColor = 0x008888;
                                aStroke = 0xaaaaaa;
                            }

                            const aRect = this.scene.add.rectangle(iconCenterX, baseY, phaseSize, phaseSize, aColor);
                            aRect.setStrokeStyle(4, aStroke);
                            this.add(aRect);
                            answersInThisRound.push(aRect);
                            
                            const t = this.scene.add.text(iconCenterX, baseY, 'A', { fontSize: '16px', color: aTextColor, fontStyle: 'bold' }).setOrigin(0.5);
                            this.add(t);
                            this.phaseTexts.push(t);
                            
                            currentX += phaseSize;
                        } else {
                            answersInThisRound.push(null);
                        }

                        // Per-question Score icon
                        if (round.updateScores === 'question') {
                            currentX += gap;
                            const iconCenterX = currentX + (phaseSize / 2);
                            
                            const isScoring = isCurrentQuestion && this.currentState === 'UPDATE_SCORES';
                            const isScored = isPastQuestion || (isCurrentQuestion && (this.currentState === 'NEXT_QUESTION' || this.currentState === 'END_ROUND'));

                            let sColor = 0x444444;
                            let sStroke = 0x888888;
                            let sTextColor = '#ffffff';

                            if (isScoring) {
                                sColor = 0xff00ff;
                                sStroke = 0xffffff;
                                sTextColor = '#000000';
                            } else if (isScored) {
                                sColor = 0x880088;
                                sStroke = 0xaaaaaa;
                            }

                            const sRect = this.scene.add.rectangle(iconCenterX, baseY, phaseSize, phaseSize, sColor);
                            sRect.setStrokeStyle(4, sStroke);
                            this.add(sRect);
                            scoresInThisRound.push(sRect);

                            const t = this.scene.add.text(iconCenterX, baseY, '$', { fontSize: '16px', color: sTextColor, fontStyle: 'bold' }).setOrigin(0.5);
                            this.add(t);
                            this.phaseTexts.push(t);

                            currentX += phaseSize;
                        } else {
                            scoresInThisRound.push(null);
                        }
                    }
                }

                // Round-end icons (only if expanded)
                const mergeRoundIcons = round.showAnswer === 'round' && round.updateScores === 'round';

                if (mergeRoundIcons) {
                    currentX += gap;
                    const iconCenterX = currentX + (phaseSize / 2);
                    const isAnswering = isCurrentRound && this.currentState === 'SHOW_ANSWER';
                    const isScoring = isCurrentRound && this.currentState === 'UPDATE_SCORES';
                    const isDone = isPastRound || (isCurrentRound && this.currentState === 'NEXT_ROUND');

                    let iconColor = 0x444444;
                    let iconStroke = 0x888888;
                    let iconTextColor = '#ffffff';

                    if (isAnswering) {
                        iconColor = 0x00ffff;
                        iconStroke = 0xffffff;
                        iconTextColor = '#000000';
                    } else if (isScoring) {
                        iconColor = 0xff00ff;
                        iconStroke = 0xffffff;
                        iconTextColor = '#000000';
                    } else if (isDone) {
                        iconColor = 0x440044;
                        iconStroke = 0xaaaaaa;
                    }

                    const rect = this.scene.add.rectangle(iconCenterX, baseY, phaseSize, phaseSize, iconColor);
                    rect.setStrokeStyle(4, iconStroke);
                    this.add(rect);
                    this.roundEndAnswerIcons.push(rect);
                    this.roundEndScoreIcons.push(rect);
                    const t = this.scene.add.text(iconCenterX, baseY, 'A$', { fontSize: '14px', color: iconTextColor, fontStyle: 'bold' }).setOrigin(0.5);
                    this.add(t);
                    this.phaseTexts.push(t);
                    currentX += phaseSize;
                } else {
                    if (round.showAnswer === 'round') {
                        currentX += gap;
                        const iconCenterX = currentX + (phaseSize / 2);
                        const isAnswering = isCurrentRound && this.currentState === 'SHOW_ANSWER';
                        const isAnswered = isPastRound || (isCurrentRound && (this.currentState === 'UPDATE_SCORES' || this.currentState === 'NEXT_ROUND'));

                        let aColor = 0x444444;
                        let aStroke = 0x888888;
                        let aTextColor = '#ffffff';

                        if (isAnswering) {
                            aColor = 0x00ffff;
                            aStroke = 0xffffff;
                            aTextColor = '#000000';
                        } else if (isAnswered) {
                            aColor = 0x008888;
                            aStroke = 0xaaaaaa;
                        }

                        const aRect = this.scene.add.rectangle(iconCenterX, baseY, phaseSize, phaseSize, aColor);
                        aRect.setStrokeStyle(4, aStroke);
                        this.add(aRect);
                        this.roundEndAnswerIcons.push(aRect);
                        const t = this.scene.add.text(iconCenterX, baseY, 'A', { fontSize: '16px', color: aTextColor, fontStyle: 'bold' }).setOrigin(0.5);
                        this.add(t);
                        this.phaseTexts.push(t);
                        currentX += phaseSize;
                    } else {
                        this.roundEndAnswerIcons.push(null);
                    }

                    if (round.updateScores === 'round') {
                        currentX += gap;
                        const iconCenterX = currentX + (phaseSize / 2);
                        const isScoring = isCurrentRound && this.currentState === 'UPDATE_SCORES';
                        const isScored = isPastRound || (isCurrentRound && this.currentState === 'NEXT_ROUND');

                        let sColor = 0x444444;
                        let sStroke = 0x888888;
                        let sTextColor = '#ffffff';

                        if (isScoring) {
                            sColor = 0xff00ff;
                            sStroke = 0xffffff;
                            sTextColor = '#000000';
                        } else if (isScored) {
                            sColor = 0x880088;
                            sStroke = 0xaaaaaa;
                        }

                        const sRect = this.scene.add.rectangle(iconCenterX, baseY, phaseSize, phaseSize, sColor);
                        sRect.setStrokeStyle(4, sStroke);
                        this.add(sRect);
                        this.roundEndScoreIcons.push(sRect);
                        const t = this.scene.add.text(iconCenterX, baseY, '$', { fontSize: '16px', color: sTextColor, fontStyle: 'bold' }).setOrigin(0.5);
                        this.add(t);
                        this.phaseTexts.push(t);
                        currentX += phaseSize;
                    } else {
                        this.roundEndScoreIcons.push(null);
                    }
                }
            } else {
                this.roundEndAnswerIcons.push(null);
                this.roundEndScoreIcons.push(null);
            }

            this.questionCircles.push(questionsInThisRound);
            this.questionTexts.push(textsInThisRound);
            this.answerIcons.push(answersInThisRound);
            this.scoreIcons.push(scoresInThisRound);
        });

        // Add Trophy icon at the very end
        currentX += gap + 24; // Half of trophy width approx
        this.trophyIcon = this.scene.add.text(currentX, baseY, '🏆', { fontSize: '48px' }).setOrigin(0.5);
        this.add(this.trophyIcon);
        currentX += 24;

        if (isEndQuiz) {
            this.trophyIcon.setAlpha(1);
            this.trophyIcon.setScale(1.2);
            this.trophyTween = this.scene.tweens.add({
                targets: this.trophyIcon,
                scale: 1.5,
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            this.trophyShineTween = this.scene.tweens.add({
                targets: this.trophyIcon,
                alpha: 0.5,
                duration: 200,
                yoyo: true,
                repeat: -1,
                repeatDelay: 1000,
                ease: 'Linear'
            });
        } else {
            this.trophyIcon.setAlpha(0.6);
            this.trophyIcon.setScale(1);
        }

        // Center the map
        this.x = (1920 - currentX) / 2;
    }
}
