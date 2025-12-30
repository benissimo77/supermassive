// FileDropzone.js
export class FileDropzone {
  constructor(options) {
    this.options = {
      element: null,              // DOM element or selector
      accept: '*/*',              // File types to accept
      multiple: false,            // Allow multiple files
      maxSize: 10 * 1024 * 1024,  // Default max size (10MB)
      onDrop: null,               // Callback when files are dropped
      onError: null,              // Callback when an error occurs
      hoverClass: 'dropzone-hover',
      ...options
    };
    
    this.element = typeof this.options.element === 'string' 
      ? document.querySelector(this.options.element)
      : this.options.element;
      
    if (!this.element) {
      console.error('Dropzone element not found');
      return;
    }
    
    this.fileInput = this.element.querySelector('input[type="file"]');
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      this.element.appendChild(this.fileInput);
    }
    
    this.fileInput.accept = this.options.accept;
    this.fileInput.multiple = this.options.multiple;
    
    this.init();
  }
  
  init() {
    // Add click handler to open file picker
    this.element.addEventListener('click', (e) => {
      if (e.target !== this.fileInput) {
        this.fileInput.click();
      }
    });
    
    // Handle file selection via input
    this.fileInput.addEventListener('change', (e) => {
      this.handleFiles(this.fileInput.files);
    });
    
    // Handle drag events
    this.element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.element.classList.add(this.options.hoverClass);
    });
    
    this.element.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.element.classList.remove(this.options.hoverClass);
    });
    
    this.element.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.element.classList.remove(this.options.hoverClass);
      
      if (e.dataTransfer.files.length > 0) {
        this.handleFiles(e.dataTransfer.files);
      }
    });
  }
  
  handleFiles(files) {
    if (files.length === 0) return;
    
    // Validate files
    const validFiles = Array.from(files).filter(file => {
      // Check file size
      if (file.size > this.options.maxSize) {
        this.triggerError(`File too large: ${file.name}`);
        return false;
      }
      
      // Check file type if accept is specified
      if (this.options.accept !== '*/*') {
        const acceptTypes = this.options.accept.split(',').map(type => type.trim());
        const fileType = file.type;
        const fileExtension = '.' + file.name.split('.').pop();
        
        // Check if file type or extension matches accept types
        const isValid = acceptTypes.some(type => {
          if (type.startsWith('.')) {
            return fileExtension.toLowerCase() === type.toLowerCase();
          } else if (type.endsWith('/*')) {
            const typeGroup = type.split('/')[0];
            return fileType.startsWith(typeGroup + '/');
          } else {
            return fileType === type;
          }
        });
        
        if (!isValid) {
          this.triggerError(`File type not accepted: ${file.name}`);
          return false;
        }
      }
      
      return true;
    });
    
    if (validFiles.length > 0) {
      if (this.options.onDrop) {
        this.options.onDrop(validFiles, this.element);
      }
    }
    
    // Reset file input
    this.fileInput.value = '';
  }
  
  triggerError(message) {
    if (this.options.onError) {
      this.options.onError(message);
    } else {
      console.error(message);
    }
  }
}