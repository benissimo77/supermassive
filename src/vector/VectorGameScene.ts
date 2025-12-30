export class VectorGameScene extends Phaser.Scene {
    private terrain: Phaser.GameObjects.Graphics;
    private ship: Phaser.GameObjects.Graphics;
    private terrainSegments: {x1: number, y1: number, x2: number, y2: number}[] = [];
    
    create() {
        // Create terrain graphics object
        this.terrain = this.add.graphics({
            lineStyle: { width: 2, color: 0x00ff00, alpha: 1 }
        });
        
        // Generate terrain - example uses sine wave
        this.generateTerrain();
        
        // Create ship
        this.ship = this.add.graphics({
            lineStyle: { width: 2, color: 0xffffff, alpha: 1 }
        });
        this.drawShip(100, 100);
        
        // Set up input for ship movement
        this.input.keyboard.on('keydown-RIGHT', () => {
            this.moveShip(5, 0);
        });
        this.input.keyboard.on('keydown-LEFT', () => {
            this.moveShip(-5, 0);
        });
        this.input.keyboard.on('keydown-UP', () => {
            this.moveShip(0, -5);
        });
        this.input.keyboard.on('keydown-DOWN', () => {
            this.moveShip(0, 5);
        });

        this.input.keyboard.on('keydown-SPACE', () => {
        console.log('Space pressed!');
    });
    }
    
    generateTerrain() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const segments = 200;
        const segmentWidth = width / segments;
        
        this.terrain.clear();
        this.terrainSegments = [];
        
        let lastX = 0;
        let lastY = height / 2;
        
        // Draw the terrain using a sine wave as example
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            // Create interesting terrain with overlapping sine waves
            const y = height / 2 + 
                      Math.sin(i * 0.1) * 50 + 
                      Math.sin(i * 0.05) * 70;
            
            if (i > 0) {
                this.terrain.lineBetween(lastX, lastY, x, y);
                this.terrainSegments.push({x1: lastX, y1: lastY, x2: x, y2: y});
            }
            
            lastX = x;
            lastY = y;
        }
    }
    
    drawShip(x: number, y: number) {
        this.ship.clear();
        this.ship.beginPath();
        
        // Draw a simple triangle ship
        this.ship.moveTo(x, y - 10);
        this.ship.lineTo(x + 7, y + 10);
        this.ship.lineTo(x - 7, y + 10);
        this.ship.closePath();
        this.ship.strokePath();
        
        // Store ship position
        this.ship.x = x;
        this.ship.y = y;
    }
    
    moveShip(dx: number, dy: number) {
        const x = this.ship.x + dx;
        const y = this.ship.y + dy;
        
        // Simple collision check
        if (this.checkTerrainCollision(x, y, 10)) {
            console.log("Collision detected!");
            return;
        }
        
        this.drawShip(x, y);
    }
    
    checkTerrainCollision(shipX: number, shipY: number, radius: number): boolean {
        // Check each terrain segment
        var minDistance:number = Infinity;
        for (const segment of this.terrainSegments) {
            // Distance from point to line segment
            const distance = this.pointToLineDistance(
                shipX, shipY,
                segment.x1, segment.y1,
                segment.x2, segment.y2
            );
            // console.log('checkTerrainCollision:', shipX, shipY, 'to segment', segment, 'distance:', distance);
            if (distance < minDistance) {
                minDistance = distance;
            }
            if (distance < radius) {
                return true;
            }
        }
        console.log('checkTerrainCollision: minDistance:', minDistance);
        return false;
    }
    
    pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        // Vector math to calculate point-to-line distance
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        
        if (len_sq !== 0) {
            param = dot / len_sq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    update() {
        // Game loop updates
    }
}
