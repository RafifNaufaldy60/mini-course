# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a single-page, client-side expense tracker using vanilla HTML, CSS, and JavaScript. The app uses an IIFE module pattern in a single `js/app.js` file, persists data to `localStorage`, and renders a Chart.js pie chart. Each task builds incrementally toward a fully wired application.

## Tasks

- [x] 1. Scaffold project structure and HTML skeleton
  - Create `index.html` at the project root with the full HTML structure: `<header>` with `#balance-display`, `<main>` with `#input-section` and `#chart-section`, and `#list-section` with sort controls and `#transaction-list`
  - Include all form elements: `#item-name`, `#item-amount`, `#item-category`, `#form-error`, `#new-category`, `#add-category-btn`, `#category-error`, `#limit-category-select`, `#limit-amount`, `#set-limit-btn`, `#limit-error`, `#sort-select`, `#empty-state`
  - Add `<canvas id="pie-chart">` with an `aria-label` attribute
  - Add `<link>` to `css/styles.css` and `<script>` tag for Chart.js CDN followed by `<script src="js/app.js">`
  - Create `css/styles.css` as an empty file and `js/app.js` as an empty IIFE shell: `(function() { 'use strict'; })();`
  - All form inputs must have associated `<label>` elements; error elements must have `aria-live="polite"`
  - _Requirements: 1.1, 9.2, 9.3_

- [x] 2. Implement State, Storage, and data model
  - [x] 2.1 Implement the State module and data constants inside the IIFE
    - Define `DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun']`
    - Define the `state` object: `{ transactions: [], categories: [], limits: {}, sortOrder: 'none' }`
    - Define the `Transaction` shape (id via `crypto.randomUUID()` with `Date.now().toString()` fallback, name, amount, category, createdAt)
    - _Requirements: 1.2, 6.1, 5.4_

  - [x] 2.2 Implement the Storage module
    - Implement `Storage.save(state)`: serialises `{ transactions, categories, limits }` (not `sortOrder`) to `localStorage` key `'expense-budget-visualizer'`; wrap in `try/catch` and log a warning on failure
    - Implement `Storage.load()`: reads and `JSON.parse`s the key; validates that the result has a `transactions` array; returns default state on missing key, parse error, or schema failure; logs a warning on corrupt data
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.5, 7.6_

  - [ ]\* 2.3 Write property test for transaction addition round-trip
    - Set up fast-check (`npm install --save-dev fast-check` or equivalent) and a test runner
    - **Property 1: Transaction addition round-trip**
    - **Validates: Requirements 1.3, 5.1**

  - [ ]\* 2.4 Write property test for custom category persistence round-trip
    - **Property 7: Custom category persistence round-trip**
    - **Validates: Requirements 6.5, 6.6**

- [x] 3. Implement the Validation module
  - [x] 3.1 Implement `Validation.validateTransaction(name, amount, category)`
    - Reject empty/whitespace-only names with "Item name is required."
    - Reject missing amount with "Amount is required."
    - Reject non-positive or non-numeric amounts with "Amount must be a positive number."
    - Return `{ valid: bool, errors: string[] }`
    - _Requirements: 1.4, 1.5_

  - [x] 3.2 Implement `Validation.validateCategory(name, existingCategories)`
    - Reject empty names with "Category name is required."
    - Reject case-insensitive duplicates with "Category already exists."
    - Return `{ valid: bool, error: string }`
    - _Requirements: 6.3, 6.4_

  - [x] 3.3 Implement `Validation.validateLimit(amount)`
    - Reject zero, negative, or non-numeric values with "Limit must be a positive number."
    - Return `{ valid: bool, error: string }`
    - _Requirements: 7.2_

  - [ ]\* 3.4 Write property test for whitespace name rejection
    - **Property 2: Empty/whitespace inputs are always rejected**
    - **Validates: Requirements 1.4**

  - [ ]\* 3.5 Write property test for non-positive amount rejection
    - **Property 3: Non-positive amounts are always rejected**
    - **Validates: Requirements 1.5**

  - [ ]\* 3.6 Write property test for category uniqueness invariant
    - **Property 6: Category uniqueness invariant**
    - **Validates: Requirements 6.2, 6.4**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement derived computation helpers
  - [x] 5.1 Implement `computeCategoryTotals(transactions)`
    - Reduce transactions into `{ [category]: totalAmount }` using `t.amount`
    - _Requirements: 4.1, 7.3_

  - [x] 5.2 Implement `computeBalance(transactions)`
    - Return the arithmetic sum of all `t.amount` values; return `0` for an empty list
    - _Requirements: 3.1_

  - [x] 5.3 Implement `sortTransactions(transactions, sortOrder)`
    - Support `'none'` (insertion order by `createdAt`), `'amount-asc'`, `'amount-desc'`, `'category-asc'`, `'category-desc'`
    - Return a new sorted array; do not mutate the input
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.4 Implement `isOverLimit(categoryTotal, limit)`
    - Return `true` if and only if `categoryTotal > limit`
    - _Requirements: 7.3, 7.4_

  - [ ]\* 5.5 Write property test for balance equals sum
    - **Property 4: Balance equals sum of transaction amounts**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]\* 5.6 Write property test for sort order correctness
    - **Property 9: Sort order correctness**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]\* 5.7 Write property test for spending limit highlight consistency
    - **Property 8: Spending limit highlight consistency**
    - **Validates: Requirements 7.3, 7.4, 7.5**

- [x] 6. Implement the Chart module
  - [x] 6.1 Implement `Chart.init(canvasId)`
    - Check for `window.Chart` (Chart.js global); if absent, hide the canvas and insert a fallback message "Chart unavailable — Chart.js could not be loaded."
    - Create a `Chart.js` pie chart instance on the canvas with empty initial data
    - Store the instance internally in the module closure
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 6.2 Implement `Chart.update(categoryTotals, limits)`
    - Update `chart.data.labels`, `chart.data.datasets[0].data`, and background colours
    - Apply a distinct highlight colour to segments whose category total exceeds its limit
    - Call `chart.update()` to re-render without destroying the instance
    - _Requirements: 4.1, 4.2, 4.3, 7.3_

  - [ ]\* 6.3 Write property test for pie chart categories matching active categories
    - **Property 5: Pie chart segments cover all and only active categories**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 7. Implement the Render module
  - [x] 7.1 Implement `renderBalance(transactions)`
    - Call `computeBalance` and update `#balance-display` text formatted as a monetary value (e.g. `$12.50`)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.2 Implement `renderTransactionList(transactions, limits, sortOrder)`
    - Call `sortTransactions` then rebuild `#transaction-list` as `<li>` elements showing name, amount, and category
    - Each `<li>` must include a delete button with a `data-id` attribute set to the transaction id
    - Apply an over-limit CSS class to list items whose category total exceeds the limit (use `computeCategoryTotals` and `isOverLimit`); include a visible text badge alongside the colour highlight
    - Show `#empty-state` when the list is empty; hide it otherwise
    - _Requirements: 2.1, 2.2, 2.4, 7.3, 7.4, 8.2, 8.3_

  - [x] 7.3 Implement `renderCategoryDropdowns(categories)`
    - Rebuild `<option>` elements in both `#item-category` and `#limit-category-select` to match `state.categories`
    - _Requirements: 1.2, 6.2, 6.6_

  - [x] 7.4 Implement the top-level `render(state)` function
    - Call `renderBalance`, `renderTransactionList`, `renderChart` (via `Chart.update`), and `renderCategoryDropdowns` in sequence
    - _Requirements: 3.2, 3.3, 4.2, 4.3_

- [x] 8. Implement event handlers and wire everything together
  - [x] 8.1 Implement `onTransactionSubmit` (handles `#transaction-form` submit)
    - Prevent default form submission
    - Read `#item-name`, `#item-amount`, `#item-category` values
    - Call `Validation.validateTransaction`; display errors in `#form-error` on failure and return
    - On success: create a transaction object, push to `state.transactions`, call `Storage.save`, call `render`, reset the form
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 5.1_

  - [x] 8.2 Implement `onDeleteTransaction` (event-delegated click on `#transaction-list`)
    - Identify the delete button via `data-id`; splice the matching transaction from `state.transactions`
    - Call `Storage.save` then `render`
    - _Requirements: 2.3, 5.2_

  - [x] 8.3 Implement `onAddCategory` (handles `#add-category-btn` click)
    - Read `#new-category` value
    - Call `Validation.validateCategory`; display error in `#category-error` on failure and return
    - On success: push to `state.categories`, call `Storage.save`, call `render`, clear the input
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 8.4 Implement `onSetLimit` (handles `#set-limit-btn` click)
    - Read `#limit-category-select` and `#limit-amount` values
    - Call `Validation.validateLimit`; display error in `#limit-error` on failure and return
    - On success: set `state.limits[category]`, call `Storage.save`, call `render`
    - _Requirements: 7.1, 7.2, 7.5, 7.6_

  - [x] 8.5 Implement `onSortChange` (handles `#sort-select` change)
    - Update `state.sortOrder` to the selected value
    - Call `render` (no `Storage.save` — sort order is not persisted)
    - _Requirements: 8.1, 8.2_

  - [x] 8.6 Implement the app initialisation block
    - Call `Storage.load()` and assign the result to `state`
    - Call `Chart.init('pie-chart')`
    - Call `render(state)`
    - Attach all event listeners: form submit, list click (delegated delete), add-category click, set-limit click, sort-select change
    - _Requirements: 5.3, 5.4, 6.6, 9.2_

  - [ ]\* 8.7 Write property test for deletion removes exactly one transaction
    - **Property 10: Deletion removes exactly one transaction**
    - **Validates: Requirements 2.3, 5.2**

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Style the application
  - [x] 10.1 Implement base layout and typography in `css/styles.css`
    - Two-column layout for `<main>` (input section left, chart section right) using CSS Grid or Flexbox
    - Full-width `#list-section` below `<main>`
    - Readable font stack, consistent spacing, and colour palette
    - _Requirements: 9.1_

  - [x] 10.2 Style the transaction list and empty state
    - Constrain `#transaction-list` height and enable `overflow-y: auto` for scrollability
    - Style each `<li>` to show name, amount, category, and delete button clearly
    - Style the over-limit highlight class with a distinct background or border colour plus the text badge
    - Style `#empty-state` as a muted placeholder message
    - _Requirements: 2.2, 2.4, 7.3_

  - [x] 10.3 Style forms, buttons, and error messages
    - Consistent input and button styles across all three form areas
    - `.error-msg` styled in a warning colour; hidden by default (use `visibility: hidden` or `display: none` toggled by JS)
    - _Requirements: 1.4, 6.3, 7.2_

  - [x] 10.4 Implement responsive / mobile-friendly layout
    - At narrow viewports (≤ 600 px) stack the two-column layout to a single column
    - Ensure touch targets are at least 44 × 44 px
    - _Requirements: 9.1, 10.3_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests use fast-check and validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- `sortOrder` is intentionally not persisted to `localStorage` — it resets to `'none'` on every page load
