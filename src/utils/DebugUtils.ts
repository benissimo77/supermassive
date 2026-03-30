// Declare the global __DEV__ variable for TypeScript
declare const __DEV__: boolean;

/**
 * Utility class for debugging that can be toggled via build flags
 * 
 * Basic usage:
 *   DebugUtils.log('message')        // Only in dev
 *   DebugUtils.error('message')      // Always shown
 * 
 * Visual debugging:
 *   DebugUtils.createRect(scene, x, y, w, h)
 *   DebugUtils.createPoint(scene, x, y)
 * 
 * Performance:
 *   DebugUtils.measureTime('operation', () => {...})
 */
export class DebugUtils {
    /**
     * Whether debugging is enabled - will be replaced by the build system
     * In development builds: true
     * In production builds: false
     */
    static readonly ENABLED = __DEV__;

    // Store original console methods to avoid recursion
    private static originalConsole = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console)
    };

    /**
     * Log a message to the console (only in debug mode)
     */
    static log(...args: any[]): void {
        if (this.ENABLED) {
            this.originalConsole.log(...args);
        }
    }

    /**
     * Log a warning to the console (only in debug mode)
     */
    static warn(...args: any[]): void {
        if (this.ENABLED) {
            this.originalConsole.warn(...args);
        }
    }

    /**
     * Log an error to the console (always shown, even in production)
     */
    static error(...args: any[]): void {
        // Errors are always logged, even in production
        this.originalConsole.error(...args);
    }

    /**
     * Log a debug message (only in debug mode)
     */
    static debug(...args: any[]): void {
        if (this.ENABLED) {
            this.originalConsole.debug(...args);
        }
    }

    /**
     * Log with timestamp prefix (only in debug mode)
     */
    static logWithTimestamp(...args: any[]): void {
        if (this.ENABLED) {
            const timestamp = new Date().toISOString();
            this.originalConsole.log(`[${timestamp}]`, ...args);
        }
    }

    /**
     * Log with scene context (only in debug mode)
     */
    static logWithScene(scene: Phaser.Scene, ...args: any[]): void {
        if (this.ENABLED) {
            this.originalConsole.log(`[${scene.scene.key}]`, ...args);
        }
    }

    /**
     * Create a visual table in console (only in debug mode)
     */
    static table(data: any): void {
        if (this.ENABLED) {
            console.table(data);
        }
    }

    /**
     * Create a console group (only in debug mode)
     */
    static group(label: string, collapsed: boolean = false): void {
        if (this.ENABLED) {
            if (collapsed) {
                console.groupCollapsed(label);
            } else {
                console.group(label);
            }
        }
    }

    /**
     * End a console group (only in debug mode)
     */
    static groupEnd(): void {
        if (this.ENABLED) {
            console.groupEnd();
        }
    }

    /**
     * Assert a condition (only in debug mode)
     */
    static assert(condition: boolean, ...args: any[]): void {
        if (this.ENABLED) {
            console.assert(condition, ...args);
        }
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
     * Create a debug line between two points
     */
    static createLine(
        scene: Phaser.Scene,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        color: number = 0xFF0000,
        lineWidth: number = 2
    ): Phaser.GameObjects.Graphics | null {
        if (!this.ENABLED) return null;

        const graphics = scene.add.graphics();
        graphics.lineStyle(lineWidth, color, 1);
        graphics.beginPath();
        graphics.moveTo(x1, y1);
        graphics.lineTo(x2, y2);
        graphics.strokePath();
        graphics.setDepth(1000);
        return graphics;
    }

    /**
     * Create a debug grid overlay
     */
    static createGrid(
        scene: Phaser.Scene,
        width: number,
        height: number,
        cellWidth: number = 100,
        cellHeight: number = 100,
        color: number = 0x00FF00,
        alpha: number = 0.3
    ): Phaser.GameObjects.Graphics | null {
        if (!this.ENABLED) return null;

        const graphics = scene.add.graphics();
        graphics.lineStyle(1, color, alpha);

        // Vertical lines
        for (let x = 0; x <= width; x += cellWidth) {
            graphics.beginPath();
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
            graphics.strokePath();
        }

        // Horizontal lines
        for (let y = 0; y <= height; y += cellHeight) {
            graphics.beginPath();
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
            graphics.strokePath();
        }

        graphics.setDepth(999);
        return graphics;
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
     * Display object bounds visually
     */
    static showBounds(
        scene: Phaser.Scene,
        gameObject: Phaser.GameObjects.GameObject & { getBounds?: () => Phaser.Geom.Rectangle },
        color: number = 0x00FF00
    ): Phaser.GameObjects.Rectangle | null {
        if (!this.ENABLED || !gameObject.getBounds) return null;

        const bounds = gameObject.getBounds();
        return this.createRect(scene, bounds.x, bounds.y, bounds.width, bounds.height, color, 0.3);
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

    /**
     * Measure async execution time
     */
    static async measureTimeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
        if (!this.ENABLED) {
            return fn();
        }
        
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        
        this.log(`⏱️ ${name} took ${(end - start).toFixed(2)}ms`);
        return result;
    }

    /**
     * Count how many times a specific point is reached
     */
    private static counters: Map<string, number> = new Map();
    
    static count(label: string = 'default'): void {
        if (!this.ENABLED) return;
        
        const current = this.counters.get(label) || 0;
        this.counters.set(label, current + 1);
        this.log(`${label}: ${current + 1}`);
    }

    /**
     * Reset a counter
     */
    static countReset(label: string = 'default'): void {
        if (!this.ENABLED) return;
        this.counters.set(label, 0);
    }

    /**
     * Trace object properties (deep inspection)
     */
    static trace(obj: any, depth: number = 2): void {
        if (!this.ENABLED) return;
        this.originalConsole.log(JSON.stringify(obj, null, 2));
    }

    /**
     * Create a performance monitor overlay
     */
    static createPerformanceMonitor(scene: Phaser.Scene): Phaser.GameObjects.Text | null {
        if (!this.ENABLED) return null;

        const text = scene.add.text(10, 10, '', {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#00FF00',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 }
        });
        text.setDepth(10000);
        text.setScrollFactor(0);

        scene.time.addEvent({
            delay: 100,
            callback: () => {
                const fps = Math.round(scene.game.loop.actualFps);
                const delta = Math.round(scene.game.loop.delta);
                text.setText(`FPS: ${fps}\nΔ: ${delta}ms`);
            },
            loop: true
        });

        return text;
    }

    /**
     * Log memory usage (if available)
     */
    static logMemory(): void {
        if (!this.ENABLED) return;

        if ('memory' in performance && (performance as any).memory) {
            const memory = (performance as any).memory;
            this.log('Memory:', {
                used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
                total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
                limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`
            });
        } else {
            this.warn('Memory API not available');
        }
    }
}