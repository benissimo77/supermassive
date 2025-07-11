// Declare the global __DEV__ variable for TypeScript
declare const __DEV__: boolean;

/**
 * Utility class for debugging that can be toggled via build flags
 * Use with: if (DebugUtils.ENABLED) { ... }
 * 
 */
export class DebugUtils {
    /**
     * Whether debugging is enabled - will be replaced by the build system
     * In development builds: true
     * In production builds: false
     */
    static readonly ENABLED = __DEV__;

    /**
     * Log a message to the console (only in debug mode)
     */
    static log(...args: any[]): void {
        if (this.ENABLED) {
            console.log(...args);
        }
    }

    /**
     * Log a warning to the console (only in debug mode)
     */
    static warn(...args: any[]): void {
        if (this.ENABLED) {
            console.warn(...args);
        }
    }

    /**
     * Log an error to the console (always shown, even in production)
     */
    static error(...args: any[]): void {
        // Errors are always logged, even in production
        console.error(...args);
    }

    /**
     * Create a debug rectangle to visualize an area
     */
    static createRect(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        color: number = 0xFF0000, 
        alpha: number = 0.5
    ): Phaser.GameObjects.Rectangle | null {
        if (!this.ENABLED) return null;
        
        const rect = scene.add.rectangle(x, y, width, height, color, alpha);
        rect.setOrigin(0, 0);
        rect.setDepth(1000); // Make sure debug visuals are on top
        return rect;
    }

    /**
     * Add a debug rectangle to a container
     */
    static addRect(
        scene: Phaser.Scene,
        container: Phaser.GameObjects.Container,
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        color: number = 0xFF0000, 
        alpha: number = 0.5
    ): Phaser.GameObjects.Rectangle | null {
        if (!this.ENABLED) return null;
        
        const rect = this.createRect(scene, x, y, width, height, color, alpha);
        if (rect) {
            container.add(rect);
        }
        return rect;
    }
    
    /**
     * Create a debug point to visualize a position
     */
    static createPoint(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        size: number = 10, 
        color: number = 0xFF0000
    ): Phaser.GameObjects.Arc | null {
        if (!this.ENABLED) return null;
        
        const point = scene.add.circle(x, y, size, color);
        point.setDepth(1000);
        return point;
    }
    
    /**
     * Add a debug text label
     */
    static addText(
        scene: Phaser.Scene,
        container: Phaser.GameObjects.Container | null,
        x: number,
        y: number,
        text: string,
        textOptions: Phaser.Types.GameObjects.Text.TextStyle = {}
    ): Phaser.GameObjects.Text | null {
        if (!this.ENABLED) return null;
        
        const defaultOptions: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 }
        };
        
        const mergedOptions = { ...defaultOptions, ...textOptions };
        const textObj = scene.add.text(x, y, text, mergedOptions);
        textObj.setDepth(1000);
        
        if (container) {
            container.add(textObj);
        }
        
        return textObj;
    }
    
    /**
     * Show coordinates in a specific position
     */
    static showCoordinates(
        scene: Phaser.Scene,
        container: Phaser.GameObjects.Container | null,
        x: number,
        y: number,
        labelX: number = 10,
        labelY: number = 10
    ): Phaser.GameObjects.Text | null {
        if (!this.ENABLED) return null;
        
        return this.addText(
            scene, 
            container, 
            labelX, 
            labelY, 
            `X: ${Math.round(x)}, Y: ${Math.round(y)}`
        );
    }
    
    /**
     * Measure execution time of a function (only in debug mode)
     */
    static measureTime<T>(name: string, fn: () => T): T {
        if (!this.ENABLED) {
            return fn();
        }
        
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        this.log(`⏱️ ${name} took ${(end - start).toFixed(2)}ms`);
        return result;
    }
}
