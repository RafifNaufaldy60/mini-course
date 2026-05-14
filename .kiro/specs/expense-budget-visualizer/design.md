# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a single-page, client-side web application built with vanilla HTML, CSS, and JavaScript. It requires no build step, no server, and no framework — it can be opened directly from the file system via `file://` or served from any static host.

The app lets users record spending transactions (name, amount, category), view a running total balance, browse a scrollable transaction list, and understand their spending distribution through a Chart.js pie chart. Custom categories, per-category spending limits with visual highlights, and flexible sort controls round out the feature set. All data is persisted in the browser's `localStorage`.

### Key Design Decisions

- **No framework**: Vanilla JS keeps the dependency surface minimal and ensures `file://` compatibility. DOM manipulation is done directly.
- **Chart.js via CDN**: Loaded from a CDN `<script>` tag in `index.html`. This is the only external dependency and is acceptable because the app targets modern browsers with internet access; a local fallback copy can be bundled if offline use is required.
- **Single JS file / single CSS file**: All application logic lives in `js/app.js`; all styles live in `css/styles.css`. This satisfies Requirement 9.3.
- **Event-driven updates**: Every mutation (add transaction, delete transaction, add category, set limit, change sort) triggers a single `render()` pass that redraws the list, balance, and chart. This keeps state and UI in sync without a virtual DOM.
- **Module pattern**: The JS file uses an IIFE (Immediately Invoked Function Expression) to avoid polluting the global namespace while remaining compatible with `file://` (no ES module `type="module"` which can be blocked by some browsers on `file://`).

---

## Architecture

```
index.html
├── <link> css/styles.css
└── <script> js/app.js
    ├── State module        — in-memory application state
    ├── Storage module      — localStorage read/write helpers
    ├── Validation module   — input validation functions
    ├── Chart module        — Chart.js wrapper (pie chart lifecycle)
    ├── Render module       — DOM rendering functions
    └── Event handlers      — form submit, delete, sort, category, limit
```

### Data Flow

```
User Action
    │
    ▼
Event Handler
    │  mutates
    ▼
State (in-memory)
    │  persists
    ▼
Storage (localStorage)
    │  triggers
    ▼
render()
    ├── renderTransactionList()
    ├── renderBalance()
    └── renderChart()
```

All state mutations go through the event handlers. After every mutation the full `render()` function is called. Because the transaction count is expected to be small (hundreds, not millions), a full re-render on every change is fast enough to meet the 100 ms requirement (Requirement 10.1).

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display">Total: $0.00</div>
  </header>

  <main>
    <!-- Left column -->
    <section id="input-section">
      <form id="transaction-form">
        <input id="item-name" type="text" placeholder="Item name" />
        <input id="item-amount" type="number" min="0.01" step="0.01" placeholder="Amount" />
        <select id="item-category"></select>
        <button type="submit">Add Transaction</button>
        <p id="form-error" class="error-msg" aria-live="polite"></p>
      </form>

      <div id="category-section">
        <input id="new-category" type="text" placeholder="New category name" />
        <button id="add-category-btn">Add Category</button>
        <p id="category-error" class="error-msg" aria-live="polite"></p>
      </div>

      <div id="limit-section">
        <select id="limit-category-select"></select>
        <input id="limit-amount" type="number" min="0.01" step="0.01" placeholder="Spending limit" />
        <button id="set-limit-btn">Set Limit</button>
        <p id="limit-error" class="error-msg" aria-live="polite"></p>
      </div>
    </section>

    <!-- Right column -->
    <section id="chart-section">
      <canvas id="pie-chart"></canvas>
    </section>
  </main>

  <section id="list-section">
    <div id="sort-controls">
      <label for="sort-select">Sort by:</label>
      <select id="sort-select">
        <option value="none">None (insertion order)</option>
        <option value="amount-asc">Amount ↑</option>
        <option value="amount-desc">Amount ↓</option>
        <option value="category-asc">Category A–Z</option>
        <option value="category-desc">Category Z–A</option>
      </select>
    </div>
    <ul id="transaction-list"></ul>
    <p id="empty-state" class="empty-msg">No transactions yet.</p>
  </section>
</body>
```

### JavaScript Modules (within `js/app.js`)

#### State Module

```js
const state = {
  transactions: [], // Transaction[]
  categories: [], // string[]  (includes defaults + custom)
  limits: {}, // { [categoryName: string]: number }
  sortOrder: "none", // SortOrder
};
```

#### Storage Module

```js
Storage.save(state); // serialises state to localStorage
Storage.load(); // deserialises state from localStorage; returns default state if empty
```

Key: `'expense-budget-visualizer'` — a single JSON blob containing all state.

#### Validation Module

```js
Validation.validateTransaction(name, amount, category); // returns { valid: bool, errors: string[] }
Validation.validateCategory(name, existingCategories); // returns { valid: bool, error: string }
Validation.validateLimit(amount); // returns { valid: bool, error: string }
```

#### Chart Module

```js
Chart.init(canvasId); // creates Chart.js instance
Chart.update(categoryTotals, limits); // updates data and re-renders
Chart.destroy(); // cleanup
```

The Chart module maintains a single `Chart.js` instance. On each `render()` call it calls `chart.data.datasets[0].data = ...` and `chart.update()` rather than destroying and recreating the chart, which avoids animation flicker.

#### Render Module

```js
render(state); // orchestrates all sub-renders
renderBalance(transactions); // updates #balance-display text
renderTransactionList(transactions, limits, sortOrder); // rebuilds #transaction-list
renderChart(transactions, limits); // calls Chart.update()
renderCategoryDropdowns(categories); // syncs both <select> dropdowns
```

#### Event Handlers

| Handler               | Trigger                        | Action                                                             |
| --------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `onTransactionSubmit` | `#transaction-form` submit     | Validate → push to `state.transactions` → save → render            |
| `onDeleteTransaction` | click on delete button in list | Splice from `state.transactions` → save → render                   |
| `onAddCategory`       | `#add-category-btn` click      | Validate → push to `state.categories` → save → render              |
| `onSetLimit`          | `#set-limit-btn` click         | Validate → set `state.limits[cat]` → save → render                 |
| `onSortChange`        | `#sort-select` change          | Set `state.sortOrder` → render (no save needed — sort is UI state) |

---

## Data Models

### Transaction

```js
{
  id: string,        // crypto.randomUUID() or Date.now().toString() fallback
  name: string,      // item name, non-empty
  amount: number,    // positive float, stored as number (not string)
  category: string,  // must match a value in state.categories
  createdAt: number, // Date.now() — used to preserve insertion order
}
```

### AppState (persisted to localStorage)

```js
{
  transactions: Transaction[],
  categories: string[],   // e.g. ["Food", "Transport", "Fun", "Coffee"]
  limits: {               // sparse — only categories with a limit set
    "Food": 200,
    "Coffee": 50,
  },
}
```

`sortOrder` is **not** persisted — it resets to `'none'` on page load (a deliberate UX choice to avoid confusion).

### SortOrder (enum-like string union)

```
'none' | 'amount-asc' | 'amount-desc' | 'category-asc' | 'category-desc'
```

### Default Categories

```js
const DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"];
```

On first load (empty localStorage), `state.categories` is initialised to `DEFAULT_CATEGORIES`.

### localStorage Schema

Single key: `'expense-budget-visualizer'`  
Value: JSON-serialised `AppState`

```json
{
  "transactions": [
    {
      "id": "abc123",
      "name": "Coffee",
      "amount": 4.5,
      "category": "Food",
      "createdAt": 1700000000000
    }
  ],
  "categories": ["Food", "Transport", "Fun"],
  "limits": { "Food": 100 }
}
```

### Category Totals (derived, not stored)

```js
// Computed on every render from state.transactions
function computeCategoryTotals(transactions) {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
}
```

---

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Transaction addition round-trip

_For any_ valid transaction (non-empty name, positive amount, valid category), after it is added to the app state and persisted to localStorage, loading the state from localStorage and looking up that transaction by id SHALL return a transaction with identical name, amount, and category.

**Validates: Requirements 1.3, 5.1**

---

### Property 2: Empty/whitespace inputs are always rejected

_For any_ string composed entirely of whitespace characters (including the empty string), submitting it as the item name SHALL be rejected by validation, and the transaction list SHALL remain unchanged.

**Validates: Requirements 1.4**

---

### Property 3: Non-positive amounts are always rejected

_For any_ numeric value that is zero or negative, submitting it as the transaction amount SHALL be rejected by validation, and the transaction list SHALL remain unchanged.

**Validates: Requirements 1.5**

---

### Property 4: Balance equals sum of transaction amounts

_For any_ list of transactions, the value displayed in the Balance_Display SHALL equal the arithmetic sum of all transaction amounts in that list.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 5: Pie chart segments cover all and only active categories

_For any_ list of transactions, the set of category labels rendered in the Pie_Chart SHALL be exactly the set of categories that have at least one transaction, with no extras and no omissions.

**Validates: Requirements 4.1, 4.2, 4.3**

---

### Property 6: Category uniqueness invariant

_For any_ sequence of add-category operations, the resulting category list SHALL contain no duplicate names (case-insensitive), regardless of the order or content of the operations.

**Validates: Requirements 6.2, 6.4**

---

### Property 7: Custom category persistence round-trip

_For any_ set of custom categories saved to localStorage, loading the app from localStorage SHALL restore exactly those custom categories (no additions, no omissions) in the category dropdown.

**Validates: Requirements 6.5, 6.6**

---

### Property 8: Spending limit highlight consistency

_For any_ category and any list of transactions, the over-limit highlight SHALL be applied if and only if the sum of transaction amounts for that category strictly exceeds the configured spending limit for that category.

**Validates: Requirements 7.3, 7.4, 7.5**

---

### Property 9: Sort order correctness

_For any_ list of transactions and any sort option, the rendered transaction list SHALL be ordered such that for every adjacent pair of items (a, b), the sort key of a compares ≤ to the sort key of b (ascending) or ≥ (descending).

**Validates: Requirements 8.1, 8.2, 8.3**

---

### Property 10: Deletion removes exactly one transaction

_For any_ transaction list and any transaction id present in that list, deleting that transaction SHALL result in a list that contains every other transaction exactly once and does not contain the deleted transaction.

**Validates: Requirements 2.3, 5.2**

---

## Error Handling

### Input Validation Errors

All validation errors are displayed inline next to the relevant form control using `aria-live="polite"` regions so screen readers announce them. Errors are cleared on the next successful submission.

| Scenario                  | Error message                       | Element           |
| ------------------------- | ----------------------------------- | ----------------- |
| Empty item name           | "Item name is required."            | `#form-error`     |
| Empty amount              | "Amount is required."               | `#form-error`     |
| Amount ≤ 0 or non-numeric | "Amount must be a positive number." | `#form-error`     |
| Empty category name       | "Category name is required."        | `#category-error` |
| Duplicate category name   | "Category already exists."          | `#category-error` |
| Empty or invalid limit    | "Limit must be a positive number."  | `#limit-error`    |

### localStorage Errors

`localStorage` access can throw in private-browsing mode or when storage is full. All `localStorage` calls are wrapped in `try/catch`. On failure the app continues to function in-memory and logs a warning to the console. No user-facing error is shown for storage failures (the app degrades gracefully).

### Chart.js Load Failure

If the Chart.js CDN script fails to load (offline use), the `<canvas>` element is hidden and replaced with a text message: "Chart unavailable — Chart.js could not be loaded." The rest of the app continues to function normally.

### Corrupt localStorage Data

On load, if `JSON.parse` throws or the parsed object fails a basic schema check (missing `transactions` array), the app resets to the default empty state and logs a warning. No data is silently corrupted.

---

## Testing Strategy

### Unit Tests

Unit tests cover pure functions in isolation using a standard test runner (e.g., Jest or a lightweight alternative like `uvu`). Key targets:

- `Validation.validateTransaction` — all valid/invalid combinations
- `Validation.validateCategory` — empty name, duplicate (case-insensitive), valid
- `Validation.validateLimit` — zero, negative, non-numeric, valid
- `computeCategoryTotals` — empty list, single category, multiple categories
- Sort comparator functions — all four sort modes, ties, empty list
- `Storage.load` — missing key, corrupt JSON, valid JSON

### Property-Based Tests

Property-based tests use [fast-check](https://github.com/dubzzz/fast-check) (a well-maintained JS PBT library). Each test runs a minimum of 100 iterations.

**Property 1 — Transaction addition round-trip**

```
// Feature: expense-budget-visualizer, Property 1: transaction addition round-trip
fc.assert(fc.property(
  arbitraryTransaction(),
  (t) => {
    const state = addTransaction(emptyState(), t);
    const loaded = Storage.load(Storage.serialise(state));
    return loaded.transactions.find(x => x.id === t.id) deepEquals t;
  }
), { numRuns: 100 });
```

**Property 2 — Whitespace names rejected**

```
// Feature: expense-budget-visualizer, Property 2: whitespace inputs rejected
fc.assert(fc.property(
  fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
  (name) => {
    const result = Validation.validateTransaction(name, 10, 'Food');
    return result.valid === false;
  }
), { numRuns: 100 });
```

**Property 3 — Non-positive amounts rejected**

```
// Feature: expense-budget-visualizer, Property 3: non-positive amounts rejected
fc.assert(fc.property(
  fc.oneof(fc.constant(0), fc.float({ max: 0 }), fc.double({ max: -Number.EPSILON })),
  (amount) => {
    const result = Validation.validateTransaction('Coffee', amount, 'Food');
    return result.valid === false;
  }
), { numRuns: 100 });
```

**Property 4 — Balance equals sum**

```
// Feature: expense-budget-visualizer, Property 4: balance equals sum of amounts
fc.assert(fc.property(
  fc.array(arbitraryTransaction()),
  (transactions) => {
    const expected = transactions.reduce((s, t) => s + t.amount, 0);
    return computeBalance(transactions) === expected;
  }
), { numRuns: 100 });
```

**Property 5 — Pie chart categories match active categories**

```
// Feature: expense-budget-visualizer, Property 5: pie chart covers active categories
fc.assert(fc.property(
  fc.array(arbitraryTransaction()),
  (transactions) => {
    const totals = computeCategoryTotals(transactions);
    const activeCategories = new Set(Object.keys(totals));
    const chartLabels = new Set(getChartLabels(totals));
    return setsEqual(activeCategories, chartLabels);
  }
), { numRuns: 100 });
```

**Property 6 — Category uniqueness**

```
// Feature: expense-budget-visualizer, Property 6: category uniqueness invariant
fc.assert(fc.property(
  fc.array(fc.string({ minLength: 1 })),
  (names) => {
    const categories = [...DEFAULT_CATEGORIES];
    for (const name of names) {
      const result = Validation.validateCategory(name, categories);
      if (result.valid) categories.push(name);
    }
    const lower = categories.map(c => c.toLowerCase());
    return lower.length === new Set(lower).size;
  }
), { numRuns: 100 });
```

**Property 7 — Custom category persistence round-trip**

```
// Feature: expense-budget-visualizer, Property 7: custom category persistence round-trip
fc.assert(fc.property(
  fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1 }),
  (names) => {
    const state = { ...emptyState(), categories: [...DEFAULT_CATEGORIES, ...names] };
    const loaded = Storage.load(Storage.serialise(state));
    return arraysEqual(loaded.categories, state.categories);
  }
), { numRuns: 100 });
```

**Property 8 — Spending limit highlight consistency**

```
// Feature: expense-budget-visualizer, Property 8: spending limit highlight consistency
fc.assert(fc.property(
  fc.array(arbitraryTransaction()),
  fc.record({ category: fc.constantFrom(...DEFAULT_CATEGORIES), limit: fc.float({ min: 0.01 }) }),
  (transactions, { category, limit }) => {
    const totals = computeCategoryTotals(transactions);
    const catTotal = totals[category] || 0;
    const highlighted = isOverLimit(catTotal, limit);
    return highlighted === (catTotal > limit);
  }
), { numRuns: 100 });
```

**Property 9 — Sort order correctness**

```
// Feature: expense-budget-visualizer, Property 9: sort order correctness
fc.assert(fc.property(
  fc.array(arbitraryTransaction()),
  fc.constantFrom('amount-asc', 'amount-desc', 'category-asc', 'category-desc'),
  (transactions, sortOrder) => {
    const sorted = sortTransactions(transactions, sortOrder);
    return isSortedCorrectly(sorted, sortOrder);
  }
), { numRuns: 100 });
```

**Property 10 — Deletion removes exactly one transaction**

```
// Feature: expense-budget-visualizer, Property 10: deletion removes exactly one transaction
fc.assert(fc.property(
  fc.array(arbitraryTransaction(), { minLength: 1 }),
  fc.nat(),
  (transactions, idx) => {
    const target = transactions[idx % transactions.length];
    const after = deleteTransaction(transactions, target.id);
    return after.length === transactions.length - 1
      && !after.some(t => t.id === target.id)
      && transactions.filter(t => t.id !== target.id).every(t => after.some(a => a.id === t.id));
  }
), { numRuns: 100 });
```

### Integration / Smoke Tests

- Open `index.html` in each target browser (Chrome, Firefox, Edge, Safari) and verify:
  - Page loads without console errors
  - Adding a transaction updates list, balance, and chart
  - Refreshing the page restores all data
  - Chart.js CDN loads successfully

### Accessibility

- All form inputs have associated `<label>` elements
- Error messages use `aria-live="polite"`
- Chart canvas has `aria-label` describing the chart
- Colour is not the sole indicator of over-limit status (a text badge is also shown)
