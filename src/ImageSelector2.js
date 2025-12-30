class ImageSelector extends HTMLElement {
    constructor() {
        super();
        this._image = null;
        this._canvas = null;
        this._ctx = null;

        this._moved = false; // if panning then we don't want to register a click at the end
        this._startX = 0;
        this._startY = 0;
        this._mode = 'hotspot'; // 'hotspot', 'rectangle' or 'disabled'
        this._answer = null; // holds the normalized coords of an answer if provided
        this._src = false;   // cache the image src ready for when element is connected to DOM
        this._connected = false; // flag to check if element is connected to DOM
        // this._resizeObserver = new ResizeObserver(this._handleResize.bind(this));

        // Add new properties for zoom
        this._scale = 1;
        this._offsetX = 0;
        this._offsetY = 0;

    }

    connectedCallback() {
        this.render();
        this.setupCanvas();
        this.setupEventListeners();
        this.setCursorType();
    }

    render() {
        this.innerHTML = `
            <style>
                .container {
                    position: relative;
                    width: 100%;
                    height: 100%; /* Full height of the parent container */
                    overflow: hidden;
                }
                img {
                    position: absolute; /* Position the image absolutely */
                    display: block; /* Remove inline spacing */
                }
                canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                    border:1px solid yellow;
                    pointer-events: none;
                }
                img.hotspot { cursor: crosshair; }
                img.rectangle { cursor: crosshair; }
                img.disabled { cursor: default; }

            </style>
            <div class="container">
                <img src="${this.getAttribute('src')}" alt="Selectable Image" draggable="false">
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

            // Center the canvas in the container
            this._canvas.style.left = `${(containerWidth - imageWidth) / 2}px`;
            this._canvas.style.top = `${(containerHeight - imageHeight) / 2}px`;
        };
    }

    setupEventListeners() {
        if (this._mode === 'disabled') {
            this._image.removeEventListener('dragstart', (e) => e.preventDefault());

            this._image.removeEventListener('pointerdown', this.handlePointerDown.bind(this));
            this._image.removeEventListener('pointermove', this.handlePointerMove.bind(this));
            this._image.removeEventListener('pointerup', this.handlePointerUp.bind(this));
            this._image.removeEventListener('pointerleave', this.handlePointerUp.bind(this));

            this._image.removeEventListener('touchstart', this.handleTouchStart.bind(this));
            this._image.removeEventListener('touchmove', this.handleTouchMove.bind(this));
            this._image.removeEventListener('touchend', this.handleTouchEnd.bind(this));

            this._image.removeEventListener('wheel', this.handleWheel.bind(this));    

        } else {

            this._image.addEventListener('dragstart', (e) => e.preventDefault());

            this._image.addEventListener('pointerdown', this.handlePointerDown.bind(this));
            this._image.addEventListener('pointermove', this.handlePointerMove.bind(this));
            this._image.addEventListener('pointerup', this.handlePointerUp.bind(this));
            this._image.addEventListener('pointerleave', this.handlePointerUp.bind(this));

            this._image.addEventListener('touchstart', this.handleTouchStart.bind(this));
            this._image.addEventListener('touchmove', this.handleTouchMove.bind(this));
            this._image.addEventListener('touchend', this.handleTouchEnd.bind(this));

            // Add wheel event listener
            if (this._mode === 'hotspot') {
                this._image.addEventListener('wheel', this.handleWheel.bind(this));    
            }
        }
    }

    setCursorType() {
        console.log('setCursorType:: this._mode:', this._mode);
        this._image.classList.remove('hotspot', 'rectangle', 'disabled');
        this._image.classList.add(this._mode);
    }


    handlePointerDown(event) {
        event.preventDefault();
        this._isDrawing = true;
        this._moved = false;

        const { x, y } = this.clientToCanvas(event.clientX, event.clientY);
        // console.log('Pointer down', x, y, this._offsetX, this._offsetY );
        this._startX = x;
        this._startY = y;
    }
    handlePointerMove(event) {
        event.preventDefault();
        if (!this._isDrawing) return;

        const { x, y } = this.clientToCanvas(event.clientX, event.clientY);

        // Diff with startX and Y to see how far we've moved
        const diffX = x - this._startX;
        const diffY = y - this._startY;

        if (Math.abs(diffX) > 5 || Math.abs(diffY) > 5) {
            this._moved = true;
        }

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
        event.preventDefault();
        if (!this._isDrawing) return;
        this._isDrawing = false;

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

        if (!this._moved) {
            this.registerSelection(canvasPos.x, canvasPos.y);
        }

        this.drawCross(0,0, 'red');
        this.drawCross(this._canvas.width, this._canvas.height, 'red');
    }

    // x, y are the canvas coordinates of where the click or tap happened
    registerSelection(x, y) {

        if (this._mode === 'hotspot') {
            this.drawCross(x, y, 'red');
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

        // We store _moved to record if the user panned at all, if so then we don't register a click at the end
        this._moved = false;
        this.dispatchEvent(new CustomEvent('touch', { detail: { type:'start', touches: event.touches.length, moved: this._moved } }));

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const { x, y } = this.clientToCanvas(touch.clientX, touch.clientY);
            this._startX = x;
            this._startY = y;
        }
        if (event.touches.length === 2) {
            this._moved = true; // if we are zooming then we clearly don't want to be clicking
            this._lastTouchDistance = this.getTouchDistance(event.touches);
        }
    }
    

    handleTouchMove(event) {
        event.preventDefault();
    
        this.dispatchEvent(new CustomEvent('touch', { type:'move', detail: event.touches.length, moved: this._moved }));

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
            this._scale = newScale;
    
            // Calculate the new offsets
            this._offsetX = containerX - mouseX * newScale;
            this._offsetY = containerY - mouseY * newScale;
    
            this.updateTransform();
    
            this._lastTouchDistance = currentDistance;

        } else if (event.touches.length === 1) {

            // Panning
            const touch = event.touches[0];
            const { x, y } = this.clientToCanvas(touch.clientX, touch.clientY);

            // Diff with startX and Y to see how far we've moved
            const diffX = x - this._startX;
            const diffY = y - this._startY;

            // If we have moved by a threshold amount then we set _moved to true
            if (Math.abs(diffX) > 5 || Math.abs(diffY) > 5) {
                this._moved = true;
                this._offsetX += diffX;
                this._offsetY += diffY;
                this.updateTransform();
            }
        }
    }
    
    // touches array holds the number of touches left after the touches have changed
    // if touches.length === 0 then all touches have been removed
    // if touches.length === 1 then one touch remains - switch to panning mode
    handleTouchEnd(event) {
        this.dispatchEvent(new CustomEvent('touch', { detail: { type:'end', touches: event.touches.length, moved: this._moved } }));
        event.preventDefault();
        if (event.touches.length === 0) {
            // we are done, clear up
            if (!this._moved) {
                // If we haven't moved at all then we can assume this is a click
                // startX and startY are the canvas coordinates of where the click or tap happened in the touchStart event
                // will not have changed (otherwise it would be a move and we would not be in this block)
                this.registerSelection(this._startX, this._startY);
            }
        }
        // any other length and we are not interested as we are only interested in 1 or 2 touches
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

    drawCross(x, y, color) {
        const crossSize = 10;
        const lineWidth = 3;

        console.log('drawCross:: x,y:', x, y, x-crossSize, y-crossSize, x+crossSize, y+crossSize);

        // For now don't clear the canvas so we can see 
        // this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        
        
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
        this._ctx.strokeStyle = color;
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



        // Conversion functions

    // Verified
    clientToImage(x, y) {
        const rect = this._image.getBoundingClientRect();
        return {
            x: x - rect.left,
            y: y - rect.top
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