export class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        if (!this.modal) {
            console.warn(`Modal with ID ${modalId} not found`);
            return;
        }
        this.closeBtn = this.modal.querySelector('.modal-close');
        this.footerCloseBtn = this.modal.querySelector('.btn-close');
        this.backdrop = this.modal.querySelector('.modal-backdrop');

        this.init();
    }

    init() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.hide());
        if (this.footerCloseBtn) this.footerCloseBtn.addEventListener('click', () => this.hide());
        if (this.backdrop) this.backdrop.addEventListener('click', () => this.hide());

        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' && this.isOpen()) this.hide();
        });
    }

    show(data = {}) {
        // Set data-attributes if provided
        for (const [key, value] of Object.entries(data)) {
            this.modal.dataset[key] = value;
        }
        this.modal.classList.add('open');
        if (typeof this.onShow === 'function') this.onShow(data);
    }

    hide() {
        this.modal.classList.remove('open');
        if (typeof this.onHide === 'function') this.onHide();
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('open');
    }

    querySelector(selector) {
        return this.modal ? this.modal.querySelector(selector) : null;
    }

    addEventListener(event, callback) {
        if (this.modal) this.modal.addEventListener(event, callback);
    }
}
