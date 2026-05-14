# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application built with HTML, CSS, and Vanilla JavaScript. It allows users to track personal spending by adding transactions with a name, amount, and category. The app displays a running total balance, a scrollable transaction list with delete capability, and a pie chart showing spending distribution by category. Data is persisted in the browser's Local Storage so it survives page refreshes. The app also supports custom categories, per-category spending limits with visual highlights, and sorting of the transaction list.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single spending record consisting of an item name, a monetary amount, and a category.
- **Category**: A label grouping transactions. Default categories are Food, Transport, and Fun. Users may add custom categories.
- **Custom_Category**: A user-defined category name added beyond the three defaults.
- **Transaction_List**: The scrollable UI component that displays all recorded transactions.
- **Balance_Display**: The UI element at the top of the page showing the sum of all transaction amounts.
- **Pie_Chart**: The visual chart component showing the proportional spending distribution across categories.
- **Spending_Limit**: A user-configured monetary threshold for a category, above which the category is visually highlighted.
- **Local_Storage**: The browser's Web Storage API used to persist transaction data and settings client-side.
- **Input_Form**: The HTML form used to enter a new transaction's item name, amount, and category.
- **Sort_Control**: The UI control that allows the user to choose the sort order of the Transaction_List.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new spending transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for item name, a numeric field for amount, and a dropdown for category selection.
2. THE Input_Form SHALL populate the category dropdown with all current categories, including any Custom_Categories.
3. WHEN the user submits the Input_Form with all fields filled and a positive amount, THE App SHALL add the transaction to the Transaction_List and persist it to Local_Storage.
4. WHEN the user submits the Input_Form with one or more empty fields, THE Input_Form SHALL display a validation error message identifying the missing field(s) and SHALL NOT add a transaction.
5. WHEN the user submits the Input_Form with an amount that is not a positive number, THE Input_Form SHALL display a validation error message and SHALL NOT add a transaction.
6. WHEN a transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty state.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see a scrollable list of all my transactions so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every recorded transaction showing its item name, amount, and category.
2. WHILE the number of transactions exceeds the visible area, THE Transaction_List SHALL be scrollable without affecting the rest of the page layout.
3. WHEN the user clicks the delete control on a transaction, THE App SHALL remove that transaction from the Transaction_List and from Local_Storage.
4. WHEN the Transaction_List contains no transactions, THE App SHALL display an empty-state message indicating no transactions have been recorded.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts formatted as a monetary value.
2. WHEN a transaction is added, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.

---

### Requirement 4: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display one segment per category that has at least one transaction, sized proportionally to that category's total amount relative to all transactions.
2. WHEN a transaction is added, THE Pie_Chart SHALL update automatically to reflect the new spending distribution.
3. WHEN a transaction is deleted, THE Pie_Chart SHALL update automatically to reflect the new spending distribution.
4. WHEN all transactions are deleted, THE Pie_Chart SHALL display an empty or placeholder state.
5. THE Pie_Chart SHALL label each segment with the category name and its percentage of total spending.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between sessions so that I do not lose my data when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL write the updated transaction list to Local_Storage.
2. WHEN a transaction is deleted, THE App SHALL write the updated transaction list to Local_Storage.
3. WHEN the App loads, THE App SHALL read all previously stored transactions from Local_Storage and render them in the Transaction_List, Balance_Display, and Pie_Chart.
4. WHEN Local_Storage contains no data, THE App SHALL initialise with an empty transaction list.

---

### Requirement 6: Custom Categories

**User Story:** As a user, I want to add my own spending categories so that I can organise transactions beyond the default Food, Transport, and Fun options.

#### Acceptance Criteria

1. THE App SHALL provide a UI control that allows the user to enter and save a new Custom_Category name.
2. WHEN the user saves a Custom_Category with a non-empty, unique name, THE App SHALL add it to the category list and make it available in the Input_Form dropdown.
3. WHEN the user attempts to save a Custom_Category with an empty name, THE App SHALL display a validation error and SHALL NOT add the category.
4. WHEN the user attempts to save a Custom_Category whose name matches an existing category (case-insensitive), THE App SHALL display a duplicate error and SHALL NOT add the category.
5. THE App SHALL persist all Custom_Categories to Local_Storage so they are available after a page reload.
6. WHEN the App loads, THE App SHALL restore all previously saved Custom_Categories from Local_Storage.

---

### Requirement 7: Spending Limit Highlight

**User Story:** As a user, I want to set a spending limit per category so that I can see a visual warning when I exceed my budget for that category.

#### Acceptance Criteria

1. THE App SHALL provide a UI control that allows the user to set a numeric Spending_Limit for any category.
2. WHEN the user saves a Spending_Limit with a positive numeric value for a category, THE App SHALL store that limit and apply it immediately.
3. WHEN the total amount of transactions in a category exceeds the Spending_Limit for that category, THE App SHALL visually highlight that category in the Transaction_List and in the Pie_Chart.
4. WHEN the total amount of transactions in a category is at or below the Spending_Limit, THE App SHALL display that category without the over-limit highlight.
5. WHEN a transaction is added or deleted, THE App SHALL re-evaluate all Spending_Limits and update highlights accordingly.
6. THE App SHALL persist all Spending_Limits to Local_Storage so they are restored after a page reload.

---

### Requirement 8: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category so that I can find and analyse my spending more easily.

#### Acceptance Criteria

1. THE Sort_Control SHALL offer the following sort options: by amount ascending, by amount descending, by category name ascending, and by category name descending.
2. WHEN the user selects a sort option, THE Transaction_List SHALL reorder all displayed transactions according to the selected option immediately.
3. WHEN a new transaction is added while a sort option is active, THE Transaction_List SHALL insert the new transaction in the correct position according to the active sort order.
4. WHEN no sort option is selected, THE Transaction_List SHALL display transactions in the order they were added (insertion order).

---

### Requirement 9: Browser Compatibility and Standalone Use

**User Story:** As a user, I want the app to work in any modern browser without installation so that I can use it anywhere.

#### Acceptance Criteria

1. THE App SHALL function correctly in the current stable versions of Chrome, Firefox, Edge, and Safari without requiring any server-side component.
2. THE App SHALL be usable as a standalone web page opened directly from the file system (via `file://` protocol) or served from a static host.
3. THE App SHALL use only one CSS file located in the `css/` directory and only one JavaScript file located in the `js/` directory.

---

### Requirement 10: Performance and Responsiveness

**User Story:** As a user, I want the app to respond instantly to my interactions so that using it feels smooth and efficient.

#### Acceptance Criteria

1. WHEN the user adds or deletes a transaction, THE App SHALL update the Transaction_List, Balance_Display, and Pie_Chart within 100ms on a modern desktop browser.
2. THE App SHALL complete its initial load and render all persisted data within 2 seconds on a modern desktop browser with no network dependency.
3. WHILE the user is interacting with the Input_Form, THE App SHALL not block or delay UI interactions in other parts of the page.
