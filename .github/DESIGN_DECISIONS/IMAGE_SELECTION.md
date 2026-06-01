Image selection DOM contract

Decision: Use a centralized, delegated image-selection handler (the `ordering` pattern) for all question types.

Why
- Single global handler simplifies behavior and debugging.
- Registry entries remain focused: `render` builds DOM, `serialize`/`deserialize` read/write data.
- Adding new question types is predictable: follow the DOM contract and you get image selection for free.

Contract (must be followed by registry `render`/`deserialize`):
- Image input wrapper: `.order-image-container` (or include this class on a container element)
- Image URL input: `data-field="order-image"`
- Image preview element: `data-field="order-image-preview"` (use background-image)
- Image select button: `button.select-order-image-btn`

Global handler expectations (in `websrc/host/dashboard-quizedit-v2.js`):
- Delegated click listener finds `button.select-order-image-btn`, then calls `btn.closest('.order-image-container')` to locate the container.
- Inside that container it looks for `[data-field="order-image"]` and `[data-field="order-image-preview"]` and updates them.

Registry author guidelines:
- Do not attach per-row `onclick` handlers for image selection; rely on the global delegation.
- Keep text fields named per-side (e.g. `left-text`, `right-text`) and use `order-image` for image URLs.
- In `serialize`, read image values by querying the per-row container for `[data-field="order-image"]` so the data model remains `leftItems`/`rightItems`.
- In `deserialize`, set the `order-image` input value and `order-image-preview` background-image for each row.

Migration note:
- Existing question types using per-row handlers should be updated to this contract for consistency.

Example snippet (row markup):

<div class="order-image-container" style="display:flex; gap:0.25rem; align-items:center;">
  <input data-field="order-image" placeholder="Image URL">
  <div data-field="order-image-preview" class="image-thumb"></div>
  <button class="select-order-image-btn">Select</button>
</div>

This document is the canonical record for image-selection behavior — update it if the global handler changes.
