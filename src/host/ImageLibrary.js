import { FileDropzone } from "./FileDropzone";

export class ImageLibrary {
  constructor(options = {}) {
    this.options = {
      onSelect: null,  // Callback when image is selected
      modalTitle: 'Image Library',
      ...options
    };

    this.selectedImage = null;
    
    // Create modal element (initially hidden)
    this.createModal();
  }

  createModal() {
    // Create modal structure
    this.modal = document.createElement('div');
    this.modal.className = 'image-selector-modal';
    this.modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${this.options.modalTitle}</h2>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="image-library-container">
            <div class="images-grid">
              <!-- Images will be loaded here -->
              <p class="loading-message">Loading images...</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
            <div class="upload-container">
              <h3>Add a new image</h3>
              <div class="dropzone" id="modal-dropzone">
                <p>Drop image here or click to select</p>
                <input type="file" style="display: none;" accept="image/*">
              </div>
            </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Initialize event listeners
    this.initEventListeners();

    // Initialize dropzone
    this.initDropzone();
  }


  initEventListeners() {
    // Close button
    this.modal.querySelector('.close-modal').addEventListener('click', () => this.close());

    // Image selection - clicking an image automatically selects and closes
    this.modal.querySelector('.images-grid').addEventListener('click', (e) => {
      const imageItem = e.target.closest('.image-item');
      if (imageItem) {
        // Store selected image data
        this.selectedImage = {
          id: imageItem.dataset.id,
          url: imageItem.dataset.url
        };

        // Call the onSelect callback with the image data
        if (this.options.onSelect) {
          this.options.onSelect(this.selectedImage);
        }
        
        // Close the modal
        this.close();
      }
    });
  }

  initDropzone() {
    // Initialize dropzone using your FileDropzone component
    new FileDropzone({
      element: this.modal.querySelector('#modal-dropzone'),
      accept: 'image/*',
      onDrop: (files) => {
        if (files.length > 0) {
          this.uploadImage(files[0]);
        }
      }
    });
  }

  show() {
    // Make modal visible
    this.modal.style.display = 'flex';

    // Load images
    this.loadImages();
  }

  close() {
    this.modal.style.display = 'none';
    this.selectedImage = null;
  }

  async loadImages() {
    try {
      const grid = this.modal.querySelector('.images-grid');
      grid.innerHTML = '<p class="loading-message">Loading images...</p>';
      
      const response = await fetch('/api/image/library');
      const result = await response.json();

      if (result.success) {
        this.renderImages(result.data);
      } else {
        console.error('Error loading images:', result.message);
        grid.innerHTML = '<p class="no-images">Error loading images</p>';
      }
    } catch (error) {
      console.error('Error loading images:', error);
      this.modal.querySelector('.images-grid').innerHTML = 
        '<p class="no-images">Error loading images</p>';
    }
  }

  // Add this to the renderImages method
renderImages(images) {
  const grid = this.modal.querySelector('.images-grid');
  grid.innerHTML = '';

  if (images.length === 0) {
    grid.innerHTML = '<p class="no-images">No images found. Add your first image below.</p>';
    return;
  }

  images.forEach(image => {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.dataset.id = image._id;
    item.dataset.url = image.url;

    item.innerHTML = `
      <div class="image-preview">
        <img src="${image.url}" alt="${image.originalName || 'Image'}">
        <button class="delete-image-btn" title="Delete image">&times;</button>
      </div>
      <div class="image-info">
        <span class="image-name">${image.originalName || 'Image'}</span>
      </div>
    `;

    grid.appendChild(item);
  });

  // Add event listeners for delete buttons
  grid.querySelectorAll('.delete-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent image selection when clicking delete
      this.handleImageDelete(e.target.closest('.image-item').dataset.id);
    });
  });
}

// Add this new method to handle image deletion
async handleImageDelete(imageId) {
  if (!confirm('Delete this image?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/images/${imageId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Reload images to update the view
      this.loadImages();
    } else {
      alert('Error deleting image: ' + result.message);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    alert('Error deleting image. Please try again.');
  }
}

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const grid = this.modal.querySelector('.images-grid');
      const currentContent = grid.innerHTML;
      grid.innerHTML = '<p class="loading-message">Uploading image...</p>';
      
      const response = await fetch('/api/image/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Reload images to show the new one
        this.loadImages();
      } else {
        alert('Error uploading image: ' + result.message);
        grid.innerHTML = currentContent; // Restore previous content
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image');
      this.loadImages(); // Reload images to reset the view
    }
  }
}