/**
 * QuestionTypeRegistry
 * 
 * This registry defines how each question type is rendered and how its data 
 * is moved between the UI (HTML) and the Database (JSON).
 * 
 * To add a new question type, simply add an entry here.
 */

// Helper to create an order/matching row. Placed in module scope so both
// `render` and `deserialize` can reuse it.
function addItemRow(listEl, side, item = {}, textFieldName = '') {
    const textField = textFieldName || `${side}-text`;
    const row = document.createElement('div');
    row.className = 'order-row mb-xs';
    row.innerHTML = `
        <input class="order-item-text matching-text" type="text" data-field="${textField}" placeholder="Text" value="${item.text || ''}">
        <div class="order-image-container">
            <input class="order-image-input" type="text" data-field="order-image" placeholder="Image URL" value="${item.image || ''}">
            <div data-field="order-image-preview" class="order-image-preview image-thumb"></div>
            <button type="button" class="btn btn-sm btn-ghost select-order-image-btn" title="Select Image"><i class="fa-solid fa-image"></i></button>
        </div>
    `;
    const imgInput = row.querySelector('[data-field="order-image"]');
    const thumb = row.querySelector('[data-field="order-image-preview"]');
    const btn = row.querySelector('.select-order-image-btn');
    imgInput.addEventListener('input', () => {
        thumb.style.backgroundImage = imgInput.value ? `url('${imgInput.value}')` : '';
        const visible = imgInput.value ? 'block' : 'none';
        thumb.style.display = visible;
        if (btn) btn.style.display = imgInput.value ? 'none' : 'inline-flex';
    });
    // Initialize preview image and button visibility
    thumb.style.backgroundImage = item.image ? `url('${item.image}')` : '';
    thumb.style.display = item.image ? 'block' : 'none';
    if (btn) btn.style.display = item.image ? 'none' : 'inline-flex';
    listEl.appendChild(row);
}

export const QuestionTypeRegistry = {
    'text': {
        label: 'Basic question - players type the answer via an on-screen keyboard',
        render: (container) => {
            container.innerHTML = `
                <div class="form-group">
                    <label>Answer:</label>
                    <input type="text" data-field="answer" placeholder="Enter answer">
                </div>
            `;
        },
        serialize: (container) => ({
            answer: container.querySelector('[data-field="answer"]').value
        }),
        deserialize: (container, data) => {
            container.querySelector('[data-field="answer"]').value = data.answer || '';
        }
    },

    'number-exact': {
        label: 'Answer is numeric - players must get the answer exactly right to score the points',
        render: (container) => {
            container.innerHTML = `
                <div class="form-group">
                    <label>Answer:</label>
                    <input type="number" data-field="answer" placeholder="Enter answer">
                </div>
            `;
        },
        serialize: (container) => {
            const val = container.querySelector('[data-field="answer"]').value;
            return { answer: val !== '' ? Number(val) : null };
        },
        deserialize: (container, data) => {
            container.querySelector('[data-field="answer"]').value = data.answer ?? '';
        }
    },

    'number-closest': {
        label: 'Answer is numeric - players who get closest to the answer score the points',
        render: (container) => {
            container.innerHTML = `
                <div class="form-group">
                    <label>Answer:</label>
                    <input type="number" data-field="answer" placeholder="Enter answer">
                </div>
            `;
        },
        serialize: (container) => {
            const val = container.querySelector('[data-field="answer"]').value;
            return { answer: val !== '' ? Number(val) : null };
        },
        deserialize: (container, data) => {
            container.querySelector('[data-field="answer"]').value = data.answer ?? '';
        }
    },

    'number-average': {
        label: 'Answer is numeric - players who get closest to the average of all player guesses score the points.',
        render: (container) => {
            container.innerHTML = `
                <div class="form-group">
                    <label>Answer:</label>
                    <input type="number" data-field="answer" placeholder="Optional answer - if there is one">
                </div>
            `;
        },
        serialize: (container) => {
            const val = container.querySelector('[data-field="answer"]').value;
            return { answer: val !== '' ? Number(val) : null };
        },
        deserialize: (container, data) => {
            container.querySelector('[data-field="answer"]').value = data.answer ?? '';
        }
    },

    'multiple-choice': {
        label: 'Players select an answer from the provided options',
        render: (container) => {
            container.innerHTML = `
                <div class="form-group mb-md">
                    <label>Options (first option is the correct one):</label>
                    <div class="flex flex-col gap-xs">
                        <input class="question-field" type="text" data-field="option-1" placeholder="Correct answer">
                        <input class="question-field" type="text" data-field="option-2" placeholder="Wrong option">
                        <input class="question-field" type="text" data-field="option-3" placeholder="Wrong option">
                        <input class="question-field" type="text" data-field="option-4" placeholder="Wrong option">
                        <hr class="options-separator">
                        <input class="question-field" type="text" data-field="option-5" placeholder="Extra option (optional)">
                        <input class="question-field" type="text" data-field="option-6" placeholder="Extra option (optional)">
                        <input class="question-field" type="text" data-field="option-7" placeholder="Extra option (optional)">
                        <input class="question-field" type="text" data-field="option-8" placeholder="Extra option (optional)">
                    </div>
                </div>
            `;
        },
        serialize: (container) => {
            const options = [];
            for (let i = 1; i <= 8; i++) {
                const val = container.querySelector(`[data-field="option-${i}"]`).value.trim();
                if (val) options.push(val);
            }
            return { options };
        },
        deserialize: (container, data) => {
            const options = data.options || [];
            for (let i = 1; i <= 8; i++) {
                container.querySelector(`[data-field="option-${i}"]`).value = options[i - 1] || '';
            }
        }
    },

    'true-false': {
        label: 'Only two possible answers here...',
        render: (container) => {
            container.innerHTML = `
                <div class="form-group">
                    <label>Answer:</label>
                    <select data-field="answer">
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select>
                </div>
            `;
        },
        serialize: (container) => ({
            answer: container.querySelector('[data-field="answer"]').value
        }),
        deserialize: (container, data) => {
            container.querySelector('[data-field="answer"]').value = String(data.answer);
        }
    },

    'ordering': {
        label: 'Players drag items into the correct order',
        render: (container) => {
            container.innerHTML = `
                <div class="form-group mb-sm">
                    <label>Start label:</label>
                    <input type="text" data-field="order-start" placeholder="eg Earliest">
                </div>
                <div class="form-group mb-sm">
                    <label>End label:</label>
                    <input type="text" data-field="order-end" placeholder="eg Latest">
                </div>
                <div class="form-group">
                    <label>Items to Order (enter in correct order):</label>
                    <div class="ordering-items flex flex-col gap-xs mt-xs"></div>
                </div>
            `;
            const itemsContainer = container.querySelector('.ordering-items');
            for (let i = 0; i < 6; i++) {
                addItemRow(itemsContainer, 'order-item', {}, 'order-item');
            }
        },
        serialize: (container) => {
            const itemInputs = Array.from(container.querySelectorAll('[data-field="order-item"]'));
            const imageInputs = Array.from(container.querySelectorAll('[data-field="order-image"]'));
            
            const items = [];
            const itemImages = [];
            let hasImages = false;

            itemInputs.forEach((input, i) => {
                const val = input.value.trim();
                const imgVal = imageInputs[i].value.trim();
                if (val !== '' || imgVal !== '') {
                    items.push(val);
                    itemImages.push(imgVal);
                    if (imgVal !== '') hasImages = true;
                }
            });

            const data = {
                items,
                extra: {
                    startLabel: container.querySelector('[data-field="order-start"]').value,
                    endLabel: container.querySelector('[data-field="order-end"]').value
                }
            };

            if (hasImages) {
                data.itemImages = itemImages;
            }

            return data;
        },
        deserialize: (container, data) => {
            container.querySelector('[data-field="order-start"]').value = data.extra?.startLabel || '';
            container.querySelector('[data-field="order-end"]').value = data.extra?.endLabel || '';
            
            const inputs = container.querySelectorAll('[data-field="order-item"]');
            const imgInputs = container.querySelectorAll('[data-field="order-image"]');
            const items = data.items || [];
            const itemImages = data.itemImages || [];
            
            inputs.forEach((input, i) => {
                input.value = items[i] || '';
                if (imgInputs[i]) {
                    const imgVal = itemImages[i] || '';
                    imgInputs[i].value = imgVal;
                    const preview = imgInputs[i].parentElement.querySelector('[data-field="order-image-preview"]');
                    if (preview) {
                        preview.style.backgroundImage = imgVal ? `url(${imgVal})` : 'none';
                        preview.style.display = imgVal ? 'block' : 'none';
                    }
                }
            });
        }
    },

    'matching': {
        label: 'Players drag items from the left to the matching option on the right',
        render: (container) => {
            container.innerHTML = `
                <label class="mb-xs">Matching Items (4 per side):</label>
                <div class="matching-columns">
                    <div class="matching-column">
                        <div class="form-group">
                            <label>Left Items</label>
                            <div class="matching-left-list"></div>
                        </div>
                    </div>
                    <div class="matching-column">
                        <div class="form-group">
                            <label>Right Items</label>
                            <div class="matching-right-list"></div>
                        </div>
                    </div>
                </div>
            `;
            // Helper is defined at module scope so both render and deserialize can use it.
            // Always 4 rows per side
            const leftList = container.querySelector('.matching-left-list');
            const rightList = container.querySelector('.matching-right-list');
            for (let i = 0; i < 4; i++) {
                addItemRow(leftList, 'left');
                addItemRow(rightList, 'right');
            }
        },
        serialize: (container) => {
            // Gather leftItems/rightItems as arrays of ImageLabel (always 4)
            const leftList = container.querySelectorAll('.matching-left-list > div');
            const rightList = container.querySelectorAll('.matching-right-list > div');
            const leftItems = [];
            const rightItems = [];
            leftList.forEach(row => {
                const text = row.querySelector('[data-field="left-text"]').value.trim();
                const image = (row.querySelector('[data-field="order-image"]') || { value: '' }).value.trim();
                if (text || image) {
                    leftItems.push({ text: text || undefined, image: image || undefined });
                }
            });
            rightList.forEach(row => {
                const text = row.querySelector('[data-field="right-text"]').value.trim();
                const image = (row.querySelector('[data-field="order-image"]') || { value: '' }).value.trim();
                if (text || image) {
                    rightItems.push({ text: text || undefined, image: image || undefined });
                }
            });
            return { leftItems, rightItems };
        },
        deserialize: (container, data) => {
            // Prefer new model
            let leftItems = data.leftItems;
            let rightItems = data.rightItems;
            // Fallback: convert legacy pairs/itemImages to new model
            if ((!leftItems || !rightItems) && Array.isArray(data.pairs)) {
                leftItems = data.pairs.map((p, i) => ({ text: p.left, image: (data.itemImages && data.itemImages[i]) || undefined }));
                rightItems = data.pairs.map((p) => ({ text: p.right }));
            }
            // Always 4 rows per side
            const leftList = container.querySelector('.matching-left-list');
            const rightList = container.querySelector('.matching-right-list');
            leftList.innerHTML = '';
            rightList.innerHTML = '';
            for (let i = 0; i < 4; i++) {
                const lItem = (Array.isArray(leftItems) && leftItems[i]) || {};
                const rItem = (Array.isArray(rightItems) && rightItems[i]) || {};
                // Left
                // Create left row using shared order-row structure
                addItemRow(leftList, 'left', lItem);
                // Right
                // Create right row using shared order-row structure
                addItemRow(rightList, 'right', rItem);
            }
        }
    },

    'hotspot': {
        label: 'Players select a point on the picture - closest players score the points',
        render: (container) => {
            container.innerHTML = `
                <image-selector data-field="image-selector-preview" class="image-selector-preview" mode="hotspot"></image-selector>
                <input type="hidden" data-field="hotspot-x">
                <input type="hidden" data-field="hotspot-y">
            `;
            // Note: Event handling for hotspot is set up in the main editor logic
            // because it needs access to common image selector utilities.
        },
        serialize: (container) => {
            const x = container.querySelector('[data-field="hotspot-x"]').value;
            const y = container.querySelector('[data-field="hotspot-y"]').value;
            return {
                answer: x ? { x: Number(x), y: Number(y) } : null
            };
        },
        deserialize: (container, data) => {
            if (data.answer) {
                container.querySelector('[data-field="hotspot-x"]').value = data.answer.x ?? '';
                container.querySelector('[data-field="hotspot-y"]').value = data.answer.y ?? '';
                const preview = container.querySelector('.image-selector-preview');
                if (preview) {
                    preview.setAttribute('answer', JSON.stringify(data.answer));
                }
            }
        }
    },

    'point-it-out': {
        label: 'Players select or box an area on the picture',
        render: (container) => {
            container.innerHTML = `
                <image-selector data-field="image-selector-preview" class="image-selector-preview" mode="rectangle"></image-selector>
                <input type="hidden" data-field="point-it-out-startx">
                <input type="hidden" data-field="point-it-out-starty">
                <input type="hidden" data-field="point-it-out-endx">
                <input type="hidden" data-field="point-it-out-endy">
            `;
        },
        serialize: (container) => {
            const sx = container.querySelector('[data-field="point-it-out-startx"]').value;
            const ex = container.querySelector('[data-field="point-it-out-endx"]').value;
            if (!sx || !ex) return { answer: null };
            return {
                answer: {
                    start: {
                        x: Number(sx),
                        y: Number(container.querySelector('[data-field="point-it-out-starty"]').value)
                    },
                    end: {
                        x: Number(ex),
                        y: Number(container.querySelector('[data-field="point-it-out-endy"]').value)
                    }
                }
            };
        },
        deserialize: (container, data) => {
            if (data.answer) {
                container.querySelector('[data-field="point-it-out-startx"]').value = data.answer.start?.x ?? '';
                container.querySelector('[data-field="point-it-out-starty"]').value = data.answer.start?.y ?? '';
                container.querySelector('[data-field="point-it-out-endx"]').value = data.answer.end?.x ?? '';
                container.querySelector('[data-field="point-it-out-endy"]').value = data.answer.end?.y ?? '';
                
                const preview = container.querySelector('.image-selector-preview');
                if (preview) {
                    preview.setAttribute('answer', JSON.stringify(data.answer));
                }
            }
        }
    },

    'draw': {
        label: 'Players draw their answer on their devices. Points can be awarded by the host after the round.',
        render: (container) => {
            container.innerHTML = `
                <div class="form-group">
                    <label>Correct Answer (optional reference):</label>
                    <input type="text" data-field="answer" placeholder="What should they be drawing?">
                </div>
            `;
        },
        serialize: (container) => ({
            answer: container.querySelector('[data-field="answer"]').value
        }),
        deserialize: (container, data) => {
            container.querySelector('[data-field="answer"]').value = data.answer || '';
        }
    }
};
