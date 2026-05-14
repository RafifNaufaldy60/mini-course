(function () {
    'use strict';

    // ---------------------------------------------------------------------------
    // State Module
    // ---------------------------------------------------------------------------

    /** Default categories available on first load */
    const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

    /**
     * In-memory application state.
     * @type {{
     *   transactions: Transaction[],
     *   categories: string[],
     *   limits: Object.<string, number>,
     *   sortOrder: string
     * }}
     */
    const state = {
        transactions: [],
        categories: [],
        limits: {},
        sortOrder: 'none',
    };

    /**
     * Transaction factory / shape definition.
     *
     * A Transaction represents a single spending record.
     *
     * Shape:
     * {
     *   id:        string   — unique identifier; uses crypto.randomUUID() when
     *                         available, falls back to Date.now().toString()
     *   name:      string   — item name, non-empty
     *   amount:    number   — positive float, stored as a number (not a string)
     *   category:  string   — must match a value in state.categories
     *   createdAt: number   — Date.now() timestamp; used to preserve insertion order
     * }
     *
     * @param {string} name
     * @param {number} amount
     * @param {string} category
     * @returns {Transaction}
     */
    function createTransaction(name, amount, category) {
        return {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : Date.now().toString(),
            name: name,
            amount: amount,
            category: category,
            createdAt: Date.now(),
        };
    }


    // ---------------------------------------------------------------------------
    // Storage Module
    // ---------------------------------------------------------------------------

    /**
     * The localStorage key used to persist application state.
     * @type {string}
     */
    const STORAGE_KEY = 'expense-budget-visualizer';

    const Storage = {
        /**
         * Serialises the relevant parts of state (transactions, categories, limits)
         * to localStorage. sortOrder is intentionally excluded — it resets on load.
         *
         * Wraps the write in a try/catch so that failures in private-browsing mode
         * or when storage is full do not crash the app.
         *
         * @param {{ transactions: Transaction[], categories: string[], limits: Object.<string, number>, sortOrder: string }} appState
         */
        save: function (appState) {
            try {
                const payload = {
                    transactions: appState.transactions,
                    categories: appState.categories,
                    limits: appState.limits,
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            } catch (err) {
                console.warn('[Storage] Failed to save state to localStorage:', err);
            }
        },

        /**
         * Reads and deserialises state from localStorage.
         *
         * Returns the default state when:
         *  - the key is absent (first visit)
         *  - JSON.parse throws (corrupt data)
         *  - the parsed object fails the basic schema check (no transactions array)
         *
         * Logs a warning to the console on corrupt data.
         *
         * @returns {{ transactions: Transaction[], categories: string[], limits: Object.<string, number>, sortOrder: string }}
         */
        load: function () {
            const defaultState = {
                transactions: [],
                categories: DEFAULT_CATEGORIES.slice(),
                limits: {},
                sortOrder: 'none',
            };

            let raw;
            try {
                raw = localStorage.getItem(STORAGE_KEY);
            } catch (err) {
                console.warn('[Storage] Failed to read from localStorage:', err);
                return defaultState;
            }

            // Key not present — first visit
            if (raw === null) {
                return defaultState;
            }

            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (err) {
                console.warn('[Storage] Corrupt data in localStorage (JSON parse error); resetting to default state.', err);
                return defaultState;
            }

            // Basic schema validation: must have a transactions array
            if (!parsed || !Array.isArray(parsed.transactions)) {
                console.warn('[Storage] Corrupt data in localStorage (missing transactions array); resetting to default state.');
                return defaultState;
            }

            return {
                transactions: parsed.transactions,
                categories: Array.isArray(parsed.categories) ? parsed.categories : DEFAULT_CATEGORIES.slice(),
                limits: (parsed.limits && typeof parsed.limits === 'object' && !Array.isArray(parsed.limits)) ? parsed.limits : {},
                sortOrder: 'none',
            };
        },
    };


    // ---------------------------------------------------------------------------
    // Validation Module
    // ---------------------------------------------------------------------------

    const Validation = {
        /**
         * Validates the inputs for a new transaction.
         *
         * Rules:
         *  - name must be a non-empty, non-whitespace-only string
         *  - amount must be present (not undefined, null, or empty string)
         *  - amount must be a positive number (> 0 and numeric)
         *
         * @param {string} name
         * @param {*} amount
         * @param {string} category
         * @returns {{ valid: boolean, errors: string[] }}
         */
        validateTransaction: function (name, amount, category) {
            const errors = [];

            // Validate name: must be non-empty and not whitespace-only
            if (typeof name !== 'string' || name.trim() === '') {
                errors.push('Item name is required.');
            }

            // Validate amount: must be present
            if (amount === undefined || amount === null || amount === '') {
                errors.push('Amount is required.');
            } else {
                // Validate amount: must be a positive number
                const numericAmount = Number(amount);
                if (isNaN(numericAmount) || numericAmount <= 0) {
                    errors.push('Amount must be a positive number.');
                }
            }

            return {
                valid: errors.length === 0,
                errors: errors,
            };
        },

        /**
         * Validates a new custom category name.
         *
         * Rules:
         *  - name must be non-empty
         *  - name must not match any existing category (case-insensitive)
         *
         * @param {string} name
         * @param {string[]} existingCategories
         * @returns {{ valid: boolean, error: string }}
         */
        validateCategory: function (name, existingCategories) {
            // Validate name: must be non-empty
            if (typeof name !== 'string' || name.trim() === '') {
                return { valid: false, error: 'Category name is required.' };
            }

            // Validate uniqueness: case-insensitive comparison
            const lowerName = name.trim().toLowerCase();
            const isDuplicate = existingCategories.some(function (cat) {
                return cat.toLowerCase() === lowerName;
            });

            if (isDuplicate) {
                return { valid: false, error: 'Category already exists.' };
            }

            return { valid: true, error: '' };
        },

        /**
         * Validates a spending limit amount.
         *
         * Rules:
         *  - amount must be a positive number (> 0 and numeric)
         *
         * @param {*} amount
         * @returns {{ valid: boolean, error: string }}
         */
        validateLimit: function (amount) {
            const numericAmount = Number(amount);

            if (amount === undefined || amount === null || amount === '' || isNaN(numericAmount) || numericAmount <= 0) {
                return { valid: false, error: 'Limit must be a positive number.' };
            }

            return { valid: true, error: '' };
        },
    };


    // ---------------------------------------------------------------------------
    // Derived Computation Helpers
    // ---------------------------------------------------------------------------

    /**
     * Reduces a list of transactions into a map of category → total amount.
     *
     * Only categories that have at least one transaction appear as keys.
     * Amounts are summed numerically using `t.amount`.
     *
     * @param {Transaction[]} transactions
     * @returns {Object.<string, number>}  e.g. { Food: 12.5, Transport: 7.0 }
     */
    function computeCategoryTotals(transactions) {
        return transactions.reduce(function (acc, t) {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
        }, {});
    }

    /**
     * Returns the arithmetic sum of all transaction amounts.
     * Returns `0` for an empty list.
     *
     * @param {Transaction[]} transactions
     * @returns {number}
     */
    function computeBalance(transactions) {
        if (transactions.length === 0) {
            return 0;
        }
        return transactions.reduce(function (sum, t) {
            return sum + t.amount;
        }, 0);
    }

    /**
     * Returns a new array of transactions sorted according to `sortOrder`.
     * The original array is never mutated.
     *
     * Supported sort orders:
     *  - 'none'          — insertion order (ascending by `createdAt`)
     *  - 'amount-asc'    — smallest amount first
     *  - 'amount-desc'   — largest amount first
     *  - 'category-asc'  — category name A → Z (locale-aware)
     *  - 'category-desc' — category name Z → A (locale-aware)
     *
     * @param {Transaction[]} transactions
     * @param {string} sortOrder
     * @returns {Transaction[]}
     */
    function sortTransactions(transactions, sortOrder) {
        // Work on a shallow copy so the original array is not mutated.
        var copy = transactions.slice();

        switch (sortOrder) {
            case 'amount-asc':
                copy.sort(function (a, b) { return a.amount - b.amount; });
                break;
            case 'amount-desc':
                copy.sort(function (a, b) { return b.amount - a.amount; });
                break;
            case 'category-asc':
                copy.sort(function (a, b) { return a.category.localeCompare(b.category); });
                break;
            case 'category-desc':
                copy.sort(function (a, b) { return b.category.localeCompare(a.category); });
                break;
            case 'none':
            default:
                // Preserve insertion order by sorting on createdAt ascending.
                copy.sort(function (a, b) { return a.createdAt - b.createdAt; });
                break;
        }

        return copy;
    }

    /**
     * Returns `true` if and only if `categoryTotal` strictly exceeds `limit`.
     *
     * @param {number} categoryTotal  — sum of amounts for the category
     * @param {number} limit          — the configured spending limit
     * @returns {boolean}
     */
    function isOverLimit(categoryTotal, limit) {
        return categoryTotal > limit;
    }


    // ---------------------------------------------------------------------------
    // Chart Module (AppChart)
    // ---------------------------------------------------------------------------
    //
    // Wraps the Chart.js pie chart lifecycle.  The module is named `AppChart` to
    // avoid collision with the `Chart` constructor exposed by Chart.js on
    // `window.Chart`.
    //
    // Internal state (the Chart.js instance) is kept in the module closure and
    // never exposed directly.

    const AppChart = (function () {
        /** @type {Chart|null} The Chart.js instance, or null before init. */
        var _chartInstance = null;

        /**
         * Colour palette for pie segments (normal / within-limit state).
         * Colours are chosen to be visually distinct across up to ~10 categories.
         */
        var PALETTE = [
            '#4e79a7',
            '#f28e2b',
            '#59a14f',
            '#76b7b2',
            '#edc948',
            '#b07aa1',
            '#ff9da7',
            '#9c755f',
            '#bab0ac',
            '#499894',
        ];

        /**
         * Highlight colour applied to segments whose category total exceeds the
         * configured spending limit for that category.
         */
        var OVER_LIMIT_COLOUR = '#e15759';

        /**
         * Initialises the Chart.js pie chart on the given canvas element.
         *
         * If `window.Chart` is not available (CDN failed to load), the canvas is
         * hidden and a fallback text message is inserted in its place.
         *
         * @param {string} canvasId  — the `id` attribute of the <canvas> element
         */
        function init(canvasId) {
            var canvas = document.getElementById(canvasId);

            // Guard: canvas element must exist in the DOM.
            if (!canvas) {
                console.warn('[AppChart] Canvas element #' + canvasId + ' not found.');
                return;
            }

            // Guard: Chart.js must be available as a global constructor.
            if (typeof window.Chart === 'undefined') {
                // Hide the canvas so it does not take up space.
                canvas.style.display = 'none';

                // Insert a human-readable fallback message immediately after the canvas.
                var fallback = document.createElement('p');
                fallback.id = 'chart-fallback';
                fallback.textContent = 'Chart unavailable \u2014 Chart.js could not be loaded.';
                fallback.style.textAlign = 'center';
                fallback.style.color = '#666';
                canvas.parentNode.insertBefore(fallback, canvas.nextSibling);

                console.warn('[AppChart] Chart.js global not found; chart disabled.');
                return;
            }

            // Create the Chart.js pie chart with empty initial data.
            _chartInstance = new window.Chart(canvas, {
                type: 'pie',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [],
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    var label = context.label || '';
                                    var value = context.parsed || 0;
                                    var total = context.dataset.data.reduce(function (s, v) { return s + v; }, 0);
                                    var pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                    return label + ': $' + value.toFixed(2) + ' (' + pct + '%)';
                                },
                            },
                        },
                    },
                },
            });
        }

        /**
         * Updates the pie chart with new category totals and spending limits.
         *
         * - Sets `chart.data.labels` to the active category names.
         * - Sets `chart.data.datasets[0].data` to the corresponding totals.
         * - Assigns background colours from the palette; applies the over-limit
         *   highlight colour to any segment whose total exceeds its limit.
         * - Calls `chart.update()` to re-render without destroying the instance.
         *
         * If the chart has not been initialised (e.g. Chart.js failed to load),
         * this method is a no-op.
         *
         * @param {Object.<string, number>} categoryTotals  — map of category → total amount
         * @param {Object.<string, number>} limits          — map of category → spending limit
         */
        function update(categoryTotals, limits) {
            if (!_chartInstance) {
                return;
            }

            var labels = Object.keys(categoryTotals);
            var data = labels.map(function (cat) { return categoryTotals[cat]; });

            var backgroundColors = labels.map(function (cat, idx) {
                var total = categoryTotals[cat];
                var limit = limits[cat];
                // Apply highlight colour when a limit is set and the total exceeds it.
                if (typeof limit === 'number' && isOverLimit(total, limit)) {
                    return OVER_LIMIT_COLOUR;
                }
                // Otherwise cycle through the palette.
                return PALETTE[idx % PALETTE.length];
            });

            _chartInstance.data.labels = labels;
            _chartInstance.data.datasets[0].data = data;
            _chartInstance.data.datasets[0].backgroundColor = backgroundColors;

            _chartInstance.update();
        }

        /**
         * Destroys the Chart.js instance and releases its resources.
         * Useful for cleanup in tests or when the canvas is removed from the DOM.
         */
        function destroy() {
            if (_chartInstance) {
                _chartInstance.destroy();
                _chartInstance = null;
            }
        }

        return {
            init: init,
            update: update,
            destroy: destroy,
        };
    }());


    // ---------------------------------------------------------------------------
    // Render Module
    // ---------------------------------------------------------------------------

    /**
     * Updates the #balance-display element with the total of all transactions,
     * formatted as a monetary value (e.g. "$12.50").
     *
     * Task 7.1 — Requirements: 3.1, 3.2, 3.3
     *
     * @param {Transaction[]} transactions
     */
    function renderBalance(transactions) {
        var el = document.getElementById('balance-display');
        if (!el) { return; }
        var total = computeBalance(transactions);
        el.textContent = 'Total: $' + total.toFixed(2);
    }

    /**
     * Rebuilds the #transaction-list <ul> from the current transactions.
     *
     * Each <li> shows the item name, amount, and category.  A delete button
     * with class "delete-btn" and a data-id attribute is included for each row.
     * When a category's total exceeds its spending limit the <li> receives the
     * "over-limit" CSS class and a visible "Over limit" text badge.
     * The #empty-state element is shown when the list is empty and hidden
     * otherwise.
     *
     * Task 7.2 — Requirements: 2.1, 2.2, 2.4, 7.3, 7.4, 8.2, 8.3
     *
     * @param {Transaction[]} transactions
     * @param {Object.<string, number>} limits
     * @param {string} sortOrder
     */
    function renderTransactionList(transactions, limits, sortOrder) {
        var list = document.getElementById('transaction-list');
        var emptyState = document.getElementById('empty-state');
        if (!list) { return; }

        // Clear existing items.
        list.innerHTML = '';

        // Show / hide empty-state message.
        if (emptyState) {
            emptyState.style.display = transactions.length === 0 ? '' : 'none';
        }

        if (transactions.length === 0) { return; }

        // Pre-compute category totals once for the whole list.
        var categoryTotals = computeCategoryTotals(transactions);

        // Sort before rendering.
        var sorted = sortTransactions(transactions, sortOrder);

        sorted.forEach(function (t) {
            var li = document.createElement('li');

            // Determine whether this transaction's category is over its limit.
            var limit = limits[t.category];
            var catTotal = categoryTotals[t.category] || 0;
            var overLimit = (typeof limit === 'number') && isOverLimit(catTotal, limit);

            if (overLimit) {
                li.classList.add('over-limit');
            }

            // Transaction details.
            var nameSpan = document.createElement('span');
            nameSpan.className = 'transaction-name';
            nameSpan.textContent = t.name;

            var amountSpan = document.createElement('span');
            amountSpan.className = 'transaction-amount';
            amountSpan.textContent = '$' + t.amount.toFixed(2);

            var categorySpan = document.createElement('span');
            categorySpan.className = 'transaction-category';
            categorySpan.textContent = t.category;

            // Over-limit text badge (visible alongside the colour highlight).
            var badge = document.createElement('span');
            badge.className = 'over-limit-badge';
            badge.textContent = 'Over limit';
            // Hide the badge when not over limit so it takes no space.
            badge.style.display = overLimit ? '' : 'none';

            // Delete button.
            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-btn';
            deleteBtn.setAttribute('data-id', t.id);
            deleteBtn.setAttribute('aria-label', 'Delete transaction: ' + t.name);
            deleteBtn.textContent = 'Delete';

            li.appendChild(nameSpan);
            li.appendChild(amountSpan);
            li.appendChild(categorySpan);
            li.appendChild(badge);
            li.appendChild(deleteBtn);

            list.appendChild(li);
        });
    }

    /**
     * Rebuilds the <option> elements in both the #item-category and
     * #limit-category-select dropdowns to match the provided categories array.
     *
     * Task 7.3 — Requirements: 1.2, 6.2, 6.6
     *
     * @param {string[]} categories
     */
    function renderCategoryDropdowns(categories) {
        var selects = [
            document.getElementById('item-category'),
            document.getElementById('limit-category-select'),
        ];

        selects.forEach(function (select) {
            if (!select) { return; }

            // Remember the currently selected value so we can restore it.
            var previousValue = select.value;

            // Rebuild options.
            select.innerHTML = '';
            categories.forEach(function (cat) {
                var option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                select.appendChild(option);
            });

            // Restore previous selection if it still exists.
            if (previousValue && categories.indexOf(previousValue) !== -1) {
                select.value = previousValue;
            }
        });
    }

    /**
     * Top-level render function.  Orchestrates all sub-renders in sequence:
     *   1. renderBalance
     *   2. renderTransactionList
     *   3. AppChart.update (pie chart)
     *   4. renderCategoryDropdowns
     *
     * Task 7.4 — Requirements: 3.2, 3.3, 4.2, 4.3
     *
     * @param {{ transactions: Transaction[], categories: string[], limits: Object.<string, number>, sortOrder: string }} appState
     */
    function render(appState) {
        renderBalance(appState.transactions);
        renderTransactionList(appState.transactions, appState.limits, appState.sortOrder);
        AppChart.update(computeCategoryTotals(appState.transactions), appState.limits);
        renderCategoryDropdowns(appState.categories);
    }


    // ---------------------------------------------------------------------------
    // Event Handlers
    // ---------------------------------------------------------------------------

    /**
     * Handles submission of the #transaction-form.
     *
     * - Prevents the default browser form submission.
     * - Reads #item-name, #item-amount, and #item-category values.
     * - Validates via Validation.validateTransaction; on failure displays joined
     *   error messages in #form-error and returns early.
     * - On success: creates a transaction, pushes it to state.transactions,
     *   persists via Storage.save, re-renders, and resets the form.
     *
     * Task 8.1 — Requirements: 1.3, 1.4, 1.5, 1.6, 5.1
     *
     * @param {Event} event
     */
    function onTransactionSubmit(event) {
        event.preventDefault();

        var form = document.getElementById('transaction-form');
        var nameInput = document.getElementById('item-name');
        var amountInput = document.getElementById('item-amount');
        var categoryInput = document.getElementById('item-category');
        var formError = document.getElementById('form-error');

        var name = nameInput ? nameInput.value : '';
        var amount = amountInput ? amountInput.value : '';
        var category = categoryInput ? categoryInput.value : '';

        var result = Validation.validateTransaction(name, amount, category);

        if (!result.valid) {
            if (formError) {
                formError.textContent = result.errors.join(' ');
            }
            return;
        }

        // Clear any previous error message.
        if (formError) {
            formError.textContent = '';
        }

        // Create and store the new transaction.
        var transaction = createTransaction(name.trim(), Number(amount), category);
        state.transactions.push(transaction);
        Storage.save(state);
        render(state);

        // Reset the form to its default empty state (Requirement 1.6).
        if (form) {
            form.reset();
        }
    }

    /**
     * Handles click events on #transaction-list using event delegation.
     *
     * Identifies delete buttons by their data-id attribute, splices the matching
     * transaction from state.transactions, persists the change, and re-renders.
     *
     * Task 8.2 — Requirements: 2.3, 5.2
     *
     * @param {Event} event
     */
    function onDeleteTransaction(event) {
        var target = event.target;

        // Walk up the DOM in case the click landed on a child of the button.
        while (target && target !== event.currentTarget) {
            if (target.classList && target.classList.contains('delete-btn')) {
                break;
            }
            target = target.parentNode;
        }

        if (!target || !target.classList || !target.classList.contains('delete-btn')) {
            return;
        }

        var id = target.getAttribute('data-id');
        if (!id) { return; }

        var idx = state.transactions.findIndex(function (t) { return t.id === id; });
        if (idx === -1) { return; }

        state.transactions.splice(idx, 1);
        Storage.save(state);
        render(state);
    }

    /**
     * Handles clicks on #add-category-btn.
     *
     * - Reads #new-category value.
     * - Validates via Validation.validateCategory; on failure displays the error
     *   in #category-error and returns early.
     * - On success: pushes the trimmed name to state.categories, persists,
     *   re-renders, and clears the input.
     *
     * Task 8.3 — Requirements: 6.2, 6.3, 6.4, 6.5
     */
    function onAddCategory() {
        var input = document.getElementById('new-category');
        var categoryError = document.getElementById('category-error');

        var name = input ? input.value : '';

        var result = Validation.validateCategory(name, state.categories);

        if (!result.valid) {
            if (categoryError) {
                categoryError.textContent = result.error;
            }
            return;
        }

        // Clear any previous error message.
        if (categoryError) {
            categoryError.textContent = '';
        }

        state.categories.push(name.trim());
        Storage.save(state);
        render(state);

        // Clear the input field.
        if (input) {
            input.value = '';
        }
    }

    /**
     * Handles clicks on #set-limit-btn.
     *
     * - Reads #limit-category-select and #limit-amount values.
     * - Validates via Validation.validateLimit; on failure displays the error
     *   in #limit-error and returns early.
     * - On success: sets state.limits[category], persists, and re-renders.
     *
     * Task 8.4 — Requirements: 7.1, 7.2, 7.5, 7.6
     */
    function onSetLimit() {
        var categorySelect = document.getElementById('limit-category-select');
        var amountInput = document.getElementById('limit-amount');
        var limitError = document.getElementById('limit-error');

        var category = categorySelect ? categorySelect.value : '';
        var amount = amountInput ? amountInput.value : '';

        var result = Validation.validateLimit(amount);

        if (!result.valid) {
            if (limitError) {
                limitError.textContent = result.error;
            }
            return;
        }

        // Clear any previous error message.
        if (limitError) {
            limitError.textContent = '';
        }

        state.limits[category] = Number(amount);
        Storage.save(state);
        render(state);
    }

    /**
     * Handles change events on #sort-select.
     *
     * Updates state.sortOrder to the newly selected value and re-renders.
     * Sort order is intentionally not persisted to localStorage — it resets
     * to 'none' on every page load.
     *
     * Task 8.5 — Requirements: 8.1, 8.2
     *
     * @param {Event} event
     */
    function onSortChange(event) {
        state.sortOrder = event.target.value;
        render(state);
    }


    // ---------------------------------------------------------------------------
    // App Initialisation
    // ---------------------------------------------------------------------------
    //
    // Task 8.6 — Requirements: 5.3, 5.4, 6.6, 9.2
    //
    // 1. Load persisted state from localStorage and merge into the in-memory
    //    state object (Object.assign preserves the const reference).
    // 2. Initialise the Chart.js pie chart.
    // 3. Perform the initial render.
    // 4. Attach all event listeners.

    (function init() {
        // Restore persisted state.  Object.assign is used because `state` is a
        // const — we cannot reassign it, but we can mutate its properties.
        Object.assign(state, Storage.load());

        // Initialise the pie chart (no-op if Chart.js failed to load).
        AppChart.init('pie-chart');

        // Render the initial UI with the loaded state.
        render(state);

        // --- Event listeners ---

        // Transaction form submit.
        var transactionForm = document.getElementById('transaction-form');
        if (transactionForm) {
            transactionForm.addEventListener('submit', onTransactionSubmit);
        }

        // Delegated delete on the transaction list.
        var transactionList = document.getElementById('transaction-list');
        if (transactionList) {
            transactionList.addEventListener('click', onDeleteTransaction);
        }

        // Add custom category.
        var addCategoryBtn = document.getElementById('add-category-btn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', onAddCategory);
        }

        // Set spending limit.
        var setLimitBtn = document.getElementById('set-limit-btn');
        if (setLimitBtn) {
            setLimitBtn.addEventListener('click', onSetLimit);
        }

        // Sort order change.
        var sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', onSortChange);
        }
    }());

})();
