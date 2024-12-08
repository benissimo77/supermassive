// ImageSelector.js
class ImageSelector extends HTMLElement {
    constructor() {
        super();
        // this.attachShadow({ mode: 'open' });
        this._image = null;
        this._canvas = null;
        this._ctx = null;
        this._isDrawing = false;
        this._isMoving = false; // if panning then we don't want to register a click at the end
        this._startX = 0;
        this._startY = 0;
        this._mode = 'hotspot'; // 'hotspot', 'rectangle' or 'disabled'
        this._answer = null; // holds the normalized coords of an answer if provided
        this._src = false;   // cache the image src ready for when element is connected to DOM
        this._connected = false; // flag to check if element is connected to DOM
        this._resizeObserver = new ResizeObserver(this._handleResize.bind(this));

        // Add new properties for zoom
        this._scale = 1;
        this._offsetX = 0;
        this._offsetY = 0;
    }

    static get observedAttributes() {
        return ['src', 'mode', 'answer'];
    }

    connectedCallback() {
        console.log('image-selector: connected:', this.isConnected);
        this._connected = true;
        this.render();
        this.setupCanvas();
        this._resizeObserver.observe(this);
        this.setupEventListeners();
        // Set a default size if not specified by the parent
        // if (!this.style.width) {
        //     console.log('connectedCallback - no style.width:');
        //     this.style.width = '100%';
        // }
        // if (!this.style.height) this.style.height = '100vh'; // You can adjust this default
    }

    disconnectedCallback() {
        this._resizeObserver.unobserve(this);
        this._connected = false;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'src':
                this.setImage(newValue);
                break;
            case 'mode':
                this._mode = newValue;
                break;
            case 'answer':
                // this._answer stores the normalized coords since we might not have the image size 
                console.log('attributeChangedCallback:: answer:', JSON.parse(newValue));
                this._answer = JSON.parse(newValue);
                this._redrawCanvas();
                break;
        }
    }

    render() {
        this.innerHTML = `
            <style>
                .container {
                    position: relative;
                    min-width: 100%;
                    min-height: 100%; /* Full height of the parent container */
                    overflow: hidden;
                }
                #image-selector-image {
                    position: absolute; /* Position the image absolutely */
                    top: 0;
                    left: 0;
                    width: 100%; /* Full width of the parent container */
                    display: block; /* Remove inline spacing */
                }
                canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                    // border:1px solid yellow;
                    pointer-events: none;
                }
                img.hotspot { cursor: crosshair; }
                img.rectangle { cursor: crosshair; }
                img.disabled { cursor: default; }

            </style>
            <div class="container">
                <img id="image-selector-image" src="${this.getAttribute('src')}" draggable="false">
                <canvas></canvas>
            </div>
        `;
    }

    setupCanvas() {
        this._image = this.querySelector('img');
        this._canvas = this.querySelector('canvas');
        this._ctx = this._canvas.getContext('2d');

        // Redraw the canvas and image when the image loads
        this._image.onload = () => {
            // Calculate the aspect ratio
            const imageAspectRatio = this._image.naturalWidth / this._image.naturalHeight;
            const containerWidth = this._image.parentElement.clientWidth;
            const containerHeight = this._image.parentElement.clientHeight;

            // Calculate the dimensions of the image based on the container size
            let imageWidth, imageHeight;

            if (containerWidth / containerHeight > imageAspectRatio) {
                // Container is wider than the image aspect ratio
                imageWidth = containerHeight * imageAspectRatio;
                imageHeight = containerHeight;
            } else {
                // Container is taller than the image aspect ratio
                imageWidth = containerWidth;
                imageHeight = containerWidth / imageAspectRatio;
            }

            // Set the image size and position
            this._image.width = imageWidth;
            this._image.height = imageHeight;
            this._image.style.left = `${(containerWidth - imageWidth) / 2}px`;
            this._image.style.top = `${(containerHeight - imageHeight) / 2}px`;

            // Set the canvas size to match the image size
            this._canvas.width = imageWidth;
            this._canvas.height = imageHeight;
            this._adjustCanvasSize();

            // Center the canvas in the container
            this._canvas.style.left = `${(containerWidth - imageWidth) / 2}px`;
            this._canvas.style.top = `${(containerHeight - imageHeight) / 2}px`;
        };
    }

    setupEventListeners() {
        if (this._mode === 'disabled') return;
        this._image.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this._image.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this._image.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this._image.addEventListener('pointerleave', this.handlePointerUp.bind(this));
        this._image.addEventListener('dragstart', (e) => e.preventDefault());

        this._image.addEventListener('touchstart', this.handleTouchStart.bind(this));
        // this._image.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this._image.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Add wheel event listener
        if (this._mode === 'hotspot') {
            this._image.addEventListener('wheel', this.handleWheel.bind(this));    
        }
    }

    handlePointerDown(event) {
        event.preventDefault();
        this._isDrawing = true;
        this._isMoving = false;
        const { x, y } = this.clientToCanvas(event.clientX, event.clientY);
        // console.log('Pointer down', x, y, this._offsetX, this._offsetY );
        this._startX = x;
        this._startY = y;
    }
    handlePointerMove(event) {
        if (this._touchStart) return;
        if (!this._isDrawing) return;
        this._isMoving = true;
        event.preventDefault();

        const { x, y } = this.clientToCanvas(event.clientX, event.clientY);

        // Diff with startX and Y to see how far we've moved
        const diffX = x - this._startX;
        const diffY = y - this._startY;

        // If question type is hotspot then we pan the image
        // If question type is rectangle then we instead draw a rectangle
        if (this._mode === 'hotspot') {
            this._offsetX += diffX;
            this._offsetY += diffY;
            this.updateTransform();
        } else {
            this.drawRect(this._startX, this._startY, x - this._startX, y - this._startY);
        }

    }
    handlePointerUp(event) {
        if (!this._isDrawing) return;
        this._isDrawing = false;
        if (this._mode === 'hotspot' && this._isMoving) return;

        event.preventDefault();
        
        const canvasPos = this.clientToCanvas(event.clientX, event.clientY);
        const imagePos = this.clientToImage(event.clientX, event.clientY);
        const containerPos = this.clientToContainer(event.clientX, event.clientY);

        console.log('Pointer up:: canvasX, canvasY:', canvasPos.x, canvasPos.y);
        console.log('Pointer up:: imageX, imageY:', imagePos.x, imagePos.y);
        console.log('Pointer up:: containerX, containerY:', containerPos.x, containerPos.y);
        console.log('Pointer up:: canvas width, height:', this._canvas.width, this._canvas.height);
        // Updated code to handle additional scale/offset properties
        // const x = (event.clientX - rect.left - this._offsetX) / this._scale;
        // const y = (event.clientY - rect.top - this._offsetY) / this._scale;
        // const x = (event.clientX - rect.left) - this._offsetX / this._scale;
        // const y = (event.clientY - rect.top) - this._offsetY / this._scale;

        // Set x and y to the correct values
        const x = canvasPos.x;
        const y = canvasPos.y;

        if (this._mode === 'hotspot') {
            this.drawCross(x, y);
        }

        // Dispatch event with the selection
        let selection = this.canvasToNormalized( x, y );
        if (this._mode === 'rectangle') {
            const leftX = Math.min( this._startX, x );
            const rightX = Math.max( this._startX, x );
            const topY = Math.min( this._startY, y );
            const bottomY = Math.max( this._startY, y );
            selection = { start: this.canvasToNormalized( leftX, topY ), end: this.canvasToNormalized( rightX, bottomY ) }
        } 
        this.dispatchEvent(new CustomEvent('selection', { detail: selection }));
        console.log('event dispatched: selection:', selection);
    }


    handleTouchStart(event) {
        event.preventDefault();
        this._isDrawing = true;
        if (event.touches.length === 2) {
            this._touchStart = true;
            this._lastTouchDistance = this.getTouchDistance(event.touches);
            this._isMoving = false;
            this._isDrawing = false;
            this._isZooming = true;
        } else if (event.touches.length === 1) {
            this._isDrawing = true;
            const touch = event.touches[0];
            const { x, y } = this.clientToCanvas(touch.clientX, touch.clientY);
            this._startX = x;
            this._startY = y;
        }
    }
    

    handleTouchMove(event) {
        if (!this._isDrawing) return;
        event.preventDefault();
    
        if (event.touches.length === 2) {
            // Zooming in creator mode
            const currentDistance = this.getTouchDistance(event.touches);
            const scaleDiff = currentDistance / this._lastTouchDistance;

            // Get the midpoint of the two touches
            const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;

            // Get mouse position in image coordinates
            const { x: mouseX, y: mouseY } = this.clientToCanvas(midX, midY);
            const { x: containerX, y: containerY } = this.clientToContainer(midX, midY);
    
            // Calculate the new scale
            const newScale = Math.max(1, Math.min(this._scale * scaleDiff, 4));

            // Update scale
            this._scale = 1;
    
            // Calculate the new offsets
            this._offsetX = containerX - mouseX * newScale;
            this._offsetY = containerY - mouseY * newScale;
    
            this.updateTransform();
    
            this._lastTouchDistance = currentDistance;

        } else if (event.touches.length === 1) {

            if (!this._isDrawing) return;

            // Panning
            const touch = event.touches[0];
            const { x, y } = this.clientToCanvas(touch.clientX, touch.clientY);

            // Diff with startX and Y to see how far we've moved
            const diffX = x - this._startX;
            const diffY = y - this._startY;

            // If question type is hotspot then we pan the image
            // If question type is rectangle then we instead draw a rectangle
            if (this._mode === 'hotspot') {
                this._offsetX += diffX;
                this._offsetY += diffY;
                this.updateTransform();
            } else {
                this.drawRect(this._startX, this._startY, x - this._startX, y - this._startY);
            }
        }
    }
    
    handleTouchEnd(event) {
        if (!this._isDrawing) return;
        if (!this._isZooming) return;
        event.preventDefault();
        this._lastTouchDistance = null;
        this._isDrawing = false;
        if (event.touches.length === 1) {
            this.handlePointerUp(event.touches[0]);
        }
    }

    getTouchDistance(touches) {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    }


    drawRect(x1, y1, x2, y2) {
        this._ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        this._ctx.fillRect(x1, y1, x2, y2);
    }

    drawCross(x, y) {
        const crossSize = 10;
        const lineWidth = 3;

        console.log('drawCross:: x,y:', x, y, x-crossSize, y-crossSize, x+crossSize, y+crossSize);

        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        // Draw white background cross
        this._ctx.strokeStyle = 'white';
        this._ctx.lineWidth = lineWidth + 2;
        this._ctx.beginPath();
        this._ctx.moveTo(x - crossSize, y - crossSize);
        this._ctx.lineTo(x + crossSize, y + crossSize);
        this._ctx.moveTo(x - crossSize, y + crossSize);
        this._ctx.lineTo(x + crossSize, y - crossSize);
        this._ctx.stroke();
        // Draw red foreground cross
        this._ctx.strokeStyle = 'red';
        this._ctx.lineWidth = lineWidth;
        this._ctx.beginPath();
        this._ctx.moveTo(x - crossSize, y - crossSize);
        this._ctx.lineTo(x + crossSize, y + crossSize);
        this._ctx.moveTo(x - crossSize, y + crossSize);
        this._ctx.lineTo(x + crossSize, y - crossSize);
        this._ctx.stroke();
    }

    handleWheel(event) {
        event.preventDefault();
        
        // Get mouse position in image coordinates
        const { x: mouseX, y: mouseY } = this.clientToCanvas(event.clientX, event.clientY);
        const { x:containerX, y:containerY } = this.clientToContainer(event.clientX, event.clientY);

        // console.log('handleWheel:: mouse x,y:', mouseX, mouseY);
        // console.log('handleWheel:: container x,y:', containerX, containerY);
        const zoomFactor = event.deltaY > 0 ? -0.5 : 0.5;
        const newScale = Math.max(1, Math.min(this._scale + zoomFactor, 4));

        // Update scale
        this._scale = newScale;

        // Calculate the new offsets - that took a while... :(
        this._offsetX = containerX - mouseX * newScale;
        this._offsetY = containerY - mouseY * newScale;

        this.updateTransform();
    }

    updateTransform() {
        const transform = `translate(${this._offsetX}px, ${this._offsetY}px) scale(${this._scale})`;
        this._image.style.transform = transform;
        this._canvas.style.transform = transform;
    }


    setImage(src) {
        console.log('setImage:: src:', src);
        this._src = src;
        if (this._connected) {
            console.log('this._connected - calling renderImage');
            this.renderImage();
        }
    }
    renderImage() {
        this._image.src = this._src;
        this._image.onload = () => {
            this._adjustCanvasSize();
        };
        this.setCursorType();
        this._adjustCanvasSize();
    }

    // This function is only called after the image has loaded
    setCursorType() {
        console.log('setCursorType:: this._mode:', this._mode);
        this._image.classList.remove('hotspot', 'rectangle', 'disabled');
        this._image.classList.add(this._mode);
    }

    _handleResize() {
        if (this._image.complete) {
            this._adjustCanvasSize();
        }
    }

    _adjustCanvasSize() {
        const rect = this._image.getBoundingClientRect();
        const windowScale = 1;
        console.log('_adjustCanvasSize:', rect, window.innerWidth/1920);
        if (rect.width == 0 | rect.height == 0) {
            return;
        }
        this._canvas.width = rect.width / windowScale;
        this._canvas.height = rect.height / windowScale;
        this._canvas.style.width = `${rect.width / windowScale}px`;
        this._canvas.style.height = `${rect.height / windowScale }px`;
        this._redrawCanvas();
    }

    _redrawCanvas() {
        // Implement redrawing logic here
        console.log('_redrawCanvas: width, height:', this._canvas.width, this._canvas.height, this._answer);
        if (this._answer) {
            if (this._mode === 'hotspot') {
                const canvasPos = this.normalizedToCanvas(this._answer.x, this._answer.y);
                this.drawCross(canvasPos.x, canvasPos.y);
            }
            if (this._mode === 'rectangle') {
                const startCanvasPos = this.normalizedToCanvas(this._answer.start.x, this._answer.start.y);
                const endCanvasPos = this.normalizedToCanvas(this._answer.end.x, this._answer.end.y);
                this.drawRect(startCanvasPos.x, startCanvasPos.y, endCanvasPos.x - startCanvasPos.x, endCanvasPos.y - startCanvasPos.y);
            }
        }
    }

    // Conversion functions

    // Verified
    clientToImage(x, y) {
        const rect = this._image.getBoundingClientRect();
        const windowScale = 1;
        return {
            x: (x - rect.left) / windowScale,
            y: (y - rect.top) / windowScale
        };
    }
    clientToCanvas(x, y) {
        const { x: imageX, y: imageY } = this.clientToImage(x, y);
        return this.imageToCanvas(imageX, imageY);
    }
    // Verified
    clientToContainer(clientX, clientY) {
        const image = this.clientToImage(clientX, clientY);
        return this.imageToContainer(image.x, image.y);
    }
    // To convert from image to canvas we just need to consider the scale
    // Offset is already built into the translation of the image/canvas
    imageToCanvas(x, y) {
        return {
            x: (x ) / this._scale,
            y: (y ) / this._scale
        };
    }
   // Verified
   // And to convert from image to container we just need to add the offset
   // Scale is already considered since the image coords are based on displayed size which is scaled
    imageToContainer(x, y) {
        return {
            x: (x + this._offsetX),
            y: (y + this._offsetY)
        };
    }
    // Verified
        
    canvasToNormalized(x, y) {
        const scaleX = 1000 / this._image.width;
        const scaleY = 1000 / this._image.height;
        return {
            x: Math.round( x * scaleX ),
            y: Math.round( y * scaleY )
        };
    }
    normalizedToCanvas(x, y) {
        const scaleX = this._image.width / 1000;
        const scaleY = this._image.height / 1000;
        return {
            x: x * scaleX,
            y: y * scaleY
        };
    }



}

customElements.define('image-selector', ImageSelector);

// Not really needed since we only need to define the custom element
export default ImageSelector;