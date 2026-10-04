import { gsap } from "gsap";
import { BaseScene } from "src/BaseScene";
import { BaseQuestionData } from "./QuestionTypes";

export abstract class PlayerBaseQuestion extends Phaser.GameObjects.Container {
    public scene: BaseScene;
    protected questionData: BaseQuestionData;
    private answerCallback: Function;
    private submittedCallback: Function;
    protected answerContainer: Phaser.GameObjects.Container;

    // The submit-feedback animation (see playSubmitAnimation) - tracked so a pending scene
    // transition can force it to finish immediately rather than let it keep ticking in the
    // background. gsap timelines live outside Phaser's tween manager, so scene.tweens.killAll()
    // never touches them.
    private activeTimeline: gsap.core.Timeline | null = null;

    constructor(scene: BaseScene, questionData: BaseQuestionData) {
        super(scene, 0, 0);
        this.questionData = questionData;
        this.scene = scene;

        this.answerContainer = this.scene.add.container(0, 0);
        this.add(this.answerContainer);
    }

    public async initialize(): Promise<void> {
        console.log('PlayerBaseQuestion::initialize: questionData:', this.questionData);
        await this.createAnswerUI();
    }

    // Render the question for the player, positioning the answer container and showing the content.
    // this.question is positioned at (0,0)
    // this.answerContainer is positioned at (960, getY(540))
    // ALL question types accept this positioning and work with it
    // eg items placed directly inside this will assume an origin of (0,0)
    // items placed inside this.answerContainer will assume an origin logical (960,540)
    public renderPlayer(): void {
        this.answerContainer.x = 960;
        this.answerContainer.y = this.scene.getY(540);
        this.showAnswerContent(1080);
    }

    // Alternative to renderPlayer() used when this class is composed as a delegate inside
    // a host question's own answerContainer in solo mode (see BaseQuestion.ts), rather than
    // rendered standalone on a player's own device. The host's answerContainer is already
    // positioned at (960, answerSlotTop) - this cancels that offset on this object's own
    // position so its coordinate space behaves exactly as if it had no host wrapper around
    // it at all (i.e. as if renderPlayer() had been called directly), then re-establishes
    // the actual slot's vertical center on the inner answerContainer. getY() is a pure
    // linear scale (logicalY * scaleFactor, no additive offset), so this cancellation is
    // exact regardless of portrait/landscape. This is what lets both center-relative math
    // (most question types, via answerContainer) and absolute canvas-relative math (e.g.
    // Ordering's submit button, parented directly to `this`) work correctly with no
    // question-type-specific changes.
    public renderAsHostDelegate(answerSlotTop: number, answerHeight: number): void {
        this.x = -960;
        this.y = -this.scene.getY(answerSlotTop);
        this.answerContainer.x = 960;
        this.answerContainer.y = this.scene.getY(answerSlotTop + answerHeight / 2);
        this.showAnswerContent(answerHeight);
    }

    // Fired immediately on submit, synchronously - this is what sends the answer to the server,
    // so it must never wait on an animation.
    public onAnswer(callback: Function): void {
        this.answerCallback = callback;
    }

    // Fired once the submit-feedback animation (see playSubmitAnimation) actually finishes -
    // this is the scene's cue to move on to its own "answer submitted" screen.
    public onSubmitted(callback: Function): void {
        this.submittedCallback = callback;
    }

    protected submitAnswer(answer: any): void {
        if (this.answerCallback) {
            this.answerCallback(answer);
        }
    }

    // Standard "answer submitted" feedback shared by every question type: slides the answer
    // panel off the bottom of the screen with a whoosh sound, then notifies the scene (see
    // onSubmitted) so it can move on. delaySeconds lets a question type pause on its own
    // highlight (e.g. showing which option was picked) before the panel slides away -
    // Draw/Hotspot have nothing to highlight, so they pass 0 (the default).
    protected playSubmitAnimation(delaySeconds: number = 0): void {
        this.activeTimeline = gsap.timeline({
            onComplete: () => {
                this.activeTimeline = null;
                this.submittedCallback?.();
            }
        });
        this.activeTimeline.to(this.answerContainer, {
            y: this.scene.getY(2160),
            duration: 0.5,
            ease: 'back.in'
        }, `+=${delaySeconds}`);
        this.activeTimeline.add(() => {
            this.scene.soundManager.playFX('submit-answer');
        }, "<+0.25");
        this.activeTimeline.play();
    }

    // Forces any in-flight submit animation to its end right now, firing onSubmitted
    // synchronously, instead of leaving it to complete later against whatever screen replaces
    // this question. Safe to call whether or not an animation is actually running.
    public finishPendingAnimation(): void {
        this.activeTimeline?.progress(1);
    }

    protected abstract createAnswerUI(): void | Promise<void>;
    protected abstract showAnswerContent(height: number): void;
    protected abstract makeInteractive(): void;
    protected abstract makeNonInteractive(): void;

    public destroy(fromScene?: boolean): void {
        console.log('PlayerBaseQuestion:: destroy:', this.questionData?.id);
        // Defensive backstop - the scene is expected to call finishPendingAnimation() (via
        // clearUI()) before destroying the current question, but kill outright here (no
        // onComplete) in case of teardown paths that don't go through that.
        this.activeTimeline?.kill();
        this.activeTimeline = null;
        super.destroy(fromScene);
    }
}
