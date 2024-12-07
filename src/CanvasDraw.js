export default class CanvasDraw extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._resizeObserver = new ResizeObserver(this.resizeCanvas.bind(this));

        this.canvasColor = '#ffffff';
        this.strokeColor = '#000000';
        this.strokeWidth = 5;
    
    }

    static get observedAttributes() {
        return ['src', 'duration'];
    }

    connectedCallback() {
        console.log('ConnectedCallback...');
        this._resizeObserver.observe(this);
        // Set a default size if not specified by the parent
        // if (!this.style.width) this.style.width = '200px';
        // if (!this.style.height) this.style.height = '120px'; // You can adjust this default

        this.render();
        this.initializeCanvas();
    }

    disconnectedCallback() {
        this._resizeObserver.unobserve(this);
    }

    render() {
        const style = `
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css');
        
        .container {
            display: flex;
            flex-direction: row-reverse;
            width:100%;
            height:100%;
            overflow:hidden;
        }
        canvas {
            border: 1px solid #ccc;
            flex:1;
            background-color: ${this.canvasColor};
        }
        .controls {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 10px;
            background-color: #f0f0f0;
            flex-shrink: 0;
        }
        .icon {
            cursor: pointer;
            width:20px;
            height:20px;
            padding: 5px;
            margin: 3px;
            border: 3px solid transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #000;
        }
        .icon.selected {
            border-color: gold;
        }
        .thin { width: 5px; height: 5px; background-color: #000; border-radius: 50%; pointer-events: none;}
        .medium { width: 10px; height: 10px; background-color: #000; border-radius: 50%; pointer-events: none;}
        .thick { width: 15px; height: 15px; background-color: #000; border-radius: 50%; pointer-events: none;}
        .very-thick { width: 20px; height: 20px; background-color: #000; border-radius: 50%; pointer-events: none;}
    </style>
    `;

        this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <div class="container">
                <div class="controls">
                    <div class="icon" data-thickness="2"><div class="thin"></div></div>
                    <div class="icon selected" data-thickness="5"><div class="medium"></div></div>
                    <div class="icon" data-thickness="12"><div class="thick"></div></div>
                    <div class="icon" data-thickness="30"><div class="very-thick"></div></div>
                    <i class="fas fa-paint-brush icon" id="brush-icon"></i>
                    <i class="fas fa-eraser icon" id="eraser-icon"></i>
                    <i class="fas fa-undo icon" id="undo-icon"></i>
                    <input type="color" id="color-picker" value="#000000">
                </div>
                <canvas id="drawing-canvas"></canvas>
            </div>
        `;
    }

    initializeCanvas() {
 
        console.log('CanvasDraw: initializeCanvas:', paper, this.shadowRoot.getElementById('drawing-canvas'));
        // Initialize Paper.js
        paper.setup(this.shadowRoot.getElementById('drawing-canvas'));

        // Set up drawing tool
        var tool = new paper.Tool();
        var path;

        tool.onMouseDown = (event) => {
            console.log('CanvasDraw: onMouseDown:', event.point, this.strokeColor, this.strokeWidth);
            path = new paper.Path();
            path.strokeColor = this.strokeColor;
            path.strokeWidth = this.strokeWidth;
            path.strokeCap = 'round'; // Set rounded ends for lines
            path.add(event.point);
        }

        tool.onMouseDrag = (event) => {
            path.add(event.point);
            path.smooth({ type: 'continuous' });
        }

        tool.onMouseUp = (event) => {
            path.add(event.point);
            path.smooth({ type: 'continuous' });
            path.simplify(); // Simplify the path to reduce the number of points
        }

        this.shadowRoot.getElementById('color-picker').addEventListener('change', (e) => {
            this.changeColor(e.target.value);
        });

        this.shadowRoot.querySelectorAll('.icon[data-thickness]').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const thickness = e.target.getAttribute('data-thickness');
                this.changeLineThickness(thickness);
                this.shadowRoot.querySelectorAll('.icon[data-thickness]').forEach(i => i.classList.remove('selected'));
                e.target.classList.add('selected');
            });
        });

        this.shadowRoot.getElementById('brush-icon').addEventListener('click', () => this.switchToBrush());
        this.shadowRoot.getElementById('eraser-icon').addEventListener('click', () => this.switchToEraser());
        this.shadowRoot.getElementById('undo-icon').addEventListener('click', () => this.undoLastPath());

        // Set the initial color and thickness
        this.changeColor(this.strokeColor);
        this.changeLineThickness(this.strokeWidth);
        this.switchToBrush();
    }

    // Function to change color
    changeColor(color) {
        this.strokeColor = color;
    }

    // Function to change line thickness
    changeLineThickness(thickness) {
        this.strokeWidth = thickness;
    }

    // Function to export drawing as SVG
    getSVG() {
        var svg = paper.project.exportSVG({ asString: true });
        return svg;
    }

    // Function to switch to brush mode
    switchToBrush() {
        this.strokeColor = this.shadowRoot.getElementById('color-picker').value;
        this.shadowRoot.getElementById('brush-icon').classList.add('selected');
        this.shadowRoot.getElementById('eraser-icon').classList.remove('selected');
    }

    // Function to switch to eraser mode
    switchToEraser() {
        this.strokeColor = this.canvasColor;
        this.shadowRoot.getElementById('eraser-icon').classList.add('selected');
        this.shadowRoot.getElementById('brush-icon').classList.remove('selected');
    }

    // Function to undo the last path
    undoLastPath() {
        if (paper.project.activeLayer.children.length > 0) {
            var lastPath = paper.project.activeLayer.children[paper.project.activeLayer.children.length - 1];
            lastPath.remove();
        }
    }

    // Resize canvas to fit the container
    resizeCanvas() {
        console.log('CanvasDraw: resizeCanvas:', this.clientWidth, this.clientHeight);
        paper.view.viewSize = new paper.Size(this.clientWidth, this.clientHeight);
    }
    
}

customElements.define('canvas-draw', CanvasDraw);