// Overlay.js
class Overlay {
    constructor(imageElement) {
        this.imageElement = imageElement;
        this.crosses = []; // Store crosses for later retrieval
        this.crossAddedCallback = null; // Store the callback
        this.updatePending = false;
        this.crossColour = "red";
        this.crossThickness = 2;
        this.mode = 'player'; // default is player view - relates to sizing of overlay and crosses
    
        this.overlayElement = this.createOverlay();
        this.imageElement.parentElement.appendChild(this.overlayElement);
        this.addEventListeners();
        this.updateOverlaySize(); // Set initial size
    }

    // setMode
    // Different behaviour whether on mobile or in browser (pfff!)
    // This codebase is getting really shitty...
    setMode(mode) {
        this.mode = mode;
        this.updateOverlaySize();
    }

    // Method to set the callback for cross added (called by parent)
    onCrossAdded(callback) {
        this.crossAddedCallback = callback;
    }
    setCrossColour(colour) {
        this.crossColour = colour;
    }
    setCrossThickness(thickness) {
        this.crossThickness = thickness;
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.style.position = 'absolute';
        overlay.style.pointerEvents = 'none'; // Allow clicks to pass through
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.border = "1px solid green";
        return overlay;
    }

    addEventListeners() {
        this.imageElement.addEventListener('click', (e) => this.imageClick(e));

        // Is there an event which will work on desktop browsers but NOT apply to mobile?
        // If so then this can be used on desktop as well (which would be nice)

        // Try resizeObserver first
        // Yes, this seems to work on desktop to correctly re-position the overlay but not on mobile
        // Tested on iPhone and iPad
        const resizeObserver = new ResizeObserver(() => { this.updateOverlaySize() } );
        resizeObserver.observe(this.imageElement.parentElement);

    }

    // updateOverlaySize
    // Very ANNOYING problem in mobile browsers - seems that (for some reason) the canvas overlay
    // does NOT align itself when its container is not left,top (0,0).
    // This happens even though they are both childen of the container, so this should NOT affect position.
    // BUT try introducing the container here to see if it affects things...
    // Hmmm... yes this solves it on mobile but likely WON'T work on desktop since getBoundingClientRect will be the same for both
    updateOverlaySizeOLD() {
        const rect = this.imageElement.getBoundingClientRect();
        const container = this.imageElement.parentElement.getBoundingClientRect();

        this.overlayElement.style.width = `${rect.width}px`;
        this.overlayElement.style.height = `${rect.height}px`;
        // Cursor suggest modifying the lines below to use offsetLeft and Top instead...
        // Needless to say it doesn't work
        // this.overlayElement.style.left = `${rect.left - container.left}px`;
        // this.overlayElement.style.top = `${rect.top - container.top}px`;
        // this.overlayElement.style.left = `${rect.offsetLeft}px`;
        // this.overlayElement.style.top = `${rect.offsetTop}px`;

        // Just revert back to the version that seems to work even though it shouldn't...
        this.overlayElement.style.left = `${rect.left - container.left}px`;
        this.overlayElement.style.top = `${rect.top - container.top}px`;

        if (this.mode == 'scaledX') {
            const windowScale = window.innerWidth / 1920;
            this.overlayElement.style.width = `${rect.width / windowScale }px`;
            this.overlayElement.style.height = `${rect.height / windowScale }px`;
            this.overlayElement.style.left = `${(rect.left  - container.left) / windowScale}px`;
            this.overlayElement.style.top = `${(rect.top - container.top) / windowScale }px`;
        }

    }

    updateOverlaySize() {
        const imgElement = this.imageElement;
        const container = imgElement.parentElement; // The container element

        // Get the bounding rect of the image and its container
        const rect = imgElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        console.log('updateOverlaySize:', rect, container);

        // Get the natural dimensions of the image
        const naturalWidth = imgElement.naturalWidth;
        const naturalHeight = imgElement.naturalHeight;

        // Calculate the aspect ratio of the image
        const aspectRatio = naturalWidth / naturalHeight;

        // Calculate the displayed size based on the container's dimensions
        let displayedWidth, displayedHeight;

        if (containerRect.width / containerRect.height > aspectRatio) {
            // Container is wider than the image aspect ratio
            displayedWidth = containerRect.height * aspectRatio;
            displayedHeight = containerRect.height;
        } else {
            // Container is taller than the image aspect ratio
            displayedWidth = containerRect.width;
            displayedHeight = containerRect.width / aspectRatio;
        }

        // Calculate the left and top position to center the image
        const leftPosition = (containerRect.width - displayedWidth) / 2;
        const topPosition = (containerRect.height - displayedHeight) / 2;

        // For player displays we don't use any of the above - that's too simple - totally different for players :(
        // Just rely on the bounding client rects of the image and its container
        this.overlayElement.style.width = `${ rect.width }px`;
        this.overlayElement.style.height = `${ rect.height }px`;
        this.overlayElement.style.left = `${rect.left - container.left}px`;
        this.overlayElement.style.top = `${rect.top - container.top}px`;

        // For host displays we use the above calculations plus adjust by scale
        if (this.mode == 'host') {
            const windowScale = window.innerWidth / 1920;
            this.overlayElement.style.width = `${ displayedWidth / windowScale }px`;
            this.overlayElement.style.height = `${ displayedHeight / windowScale}px`;
            this.overlayElement.style.left = `${ leftPosition / windowScale }px`;
            this.overlayElement.style.top = `${ topPosition / windowScale }px`;
        }
    }

    // imageClick
    // Event listener which calculates normalized position and calls addCross to place a cross at the coords given
    imageClick(event) {
        const rect = this.imageElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Since we only want to add a single cross when clicking we clear the overlay
        this.overlayElement.innerHTML = '';
        this.addCross(x, y);
    }

    // addCrosses
    // Method for adding a bunch of crosses to an overlay
    // Used when displaying the results of the player guesses and the actual answer
    addCrosses(crossList) {
        console.log('addCrosses:', crossList);
        Object.values(crossList).forEach(element => {
            const imageCoords = this.getImageCoordinates(element);
            this.addCross(imageCoords.x, imageCoords.y);
        });
    }

    // addCross
    // Event listener which calculates normalized position and calls addCross to place a cross at the coords given
    addCross(x, y) {
        const cross = document.createElement('div');
        cross.className = 'cross';
        cross.style.position = 'absolute';
        cross.style.left = `${x}px`;
        cross.style.top = `${y}px`;
        cross.style.width = '20px';
        cross.style.height = '20px';
        cross.style.transform = 'translate(-50%, -50%)';
        cross.style.stroke = this.crossColour;
        cross.style.setProperty('stroke-width', this.crossThickness);
        if (this.mode == 'host') {
            cross.style.scale = this.crossThickness;
        }

        cross.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <line x1="0" y1="0" x2="20" y2="20" />
                <line x1="20" y1="0" x2="0" y2="20" />
            </svg>
        `;

        // This line will add a new cross
        this.overlayElement.appendChild(cross);

        // For now simply replace the cross - but in future it could be possible to store an array of crosses
        this.crosses = [];
        this.crosses.push({ x, y }); // Store the cross position

        // Call the callback directly if it exists
        if (this.crossAddedCallback) {
            this.crossAddedCallback( this.getNormalizedCoordinates(0) );
        }
    }

    // addHitArea
    // Used for the point-it-out questions - shows the rectangle of the image that was designated correct
    // hitarea passed in is the answers as supplied by the quiz data
    addHitArea(hitarea) {

        // Hitarea is made up of two coordinates 'start' and 'end' in normalized form
        const { x:x1, y:y1 } = this.getImageCoordinates(hitarea.start);
        const { x:x2, y:y2 } = this.getImageCoordinates(hitarea.end);

        // Create a new div for the hit area
        const hitArea = document.createElement('div');
    
        // Calculate the width and height of the rectangle
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
    
        // Set the position and size of the hit area
        hitArea.style.position = 'absolute';
        hitArea.style.left = `${Math.min(x1, x2)}px`; // Set left position
        hitArea.style.top = `${Math.min(y1, y2)}px`; // Set top position
        hitArea.style.width = `${width}px`;
        hitArea.style.height = `${height}px`;
        hitArea.style.backgroundColor = 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red
        hitArea.style.border = '2px dashed red'; // Optional: style the rectangle
    
        // Append the hit area to the overlay element
        this.overlayElement.appendChild(hitArea);
    }
    getNormalizedCoordinates(index) {
        if (index < 0 || index >= this.crosses.length) {
            throw new Error('Invalid cross index');
        }
        const { x, y } = this.crosses[index];
        const rect = this.imageElement.getBoundingClientRect();
        const normalizedX = (x / rect.width) * 1000;
        const normalizedY = (y / rect.height) * 1000;
        return { x: Math.round(normalizedX), y: Math.round(normalizedY) };
    }
    getImageCoordinates(c) {
        const windowScale = window.innerWidth / 1920;
        const rect = this.overlayElement.getBoundingClientRect();
        const imageX = rect.width * c.x / 1000 / windowScale;
        const imageY = rect.height * c.y / 1000 / windowScale;
        return {x:imageX, y:imageY}
    }

}

export { Overlay };