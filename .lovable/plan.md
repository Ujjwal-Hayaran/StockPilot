
Build the “Smart Inventory Reordering System” MVP as a clean multi-tab web application, with stock movement recorded as “Stock In” and “Stock Out” instead of using the term “transactions.”

Core app structure:
- Replace the placeholder page with a practical inventory management interface.
- Add a top navigation/tab layout with separate sections:
  - Dashboard
  - Products
  - Stock In / Stock Out
  - Reorder Suggestions
- Keep the app simple, focused, and easy to demonstrate for a final-year project.

Tab 1: Dashboard:
- Show a high-level overview of inventory health.
- Include summary cards for:
  - Total products
  - Safe stock items
  - Low stock items
  - Critical stock items
- Show urgent stock alerts.
- Show recent stock movement activity, labeled as Stock In and Stock Out.

Tab 2: Products:
- Add a clean form for adding products with:
  - Product name
  - Category
  - Price
  - Current stock quantity
  - Supplier phone number
- Display all products in a clean table/card layout.
- Each product will show:
  - Product name
  - Category
  - Price
  - Current stock
  - Supplier phone number
  - Stock status badge: Safe / Low / Critical

Tab 3: Stock In / Stock Out:
- Replace “Transaction Tracking” with a clearer stock movement section.
- Add a form for recording:
  - Stock In: new stock added/restocked
  - Stock Out: stock sold or removed
  - Product
  - Quantity
  - Date
  - Optional note
- Automatically update product stock:
  - Stock In increases current stock.
  - Stock Out decreases current stock.
- Show stock movement history using simple labels:
  - “Stock In”
  - “Stock Out”
- Avoid using the word “transactions” in the user interface.

Tab 4: Reorder Suggestions:
- Focus this tab on the main stockout-prevention feature.
- For each product, calculate:
  - Average daily stock out
  - Estimated days of stock remaining
  - Suggested reorder quantity
- Display clear messages such as:
  - “Reorder 30 units now to avoid stockout in 5 days”
  - “Stock level is currently safe”
  - “No stock-out history yet — record stock out to generate suggestions”
- Add an “Order via WhatsApp” button for each product.

Supabase backend:
- Set up a simple Supabase database with two main tables:
  - Products: name, category, price, current stock quantity, supplier phone number
  - Stock movements: product, movement type, quantity, date, optional note
- Use movement type values such as:
  - stock_in
  - stock_out
- Keep the backend simple and MVP-focused.
- Do not add authentication for now.

Stockout prediction logic:
- Calculate average daily sales using only Stock Out records.
- Estimate remaining stock duration using:
```text
days remaining = current stock / average daily stock out
```
- Use a fixed supplier lead time of 3 days.
- Suggested status rules:
  - Critical: stock is zero or expected to run out within 3 days
  - Low: stock is expected to run out soon after the lead time
  - Safe: stock is not at immediate risk
- Keep the logic simple and explainable.

Smart reorder suggestion:
- Use average daily stock out and the 3-day lead time to suggest reorder quantity.
- Round suggested reorder quantities to practical whole numbers.
- Clearly handle products with no stock-out history yet.

WhatsApp reorder integration:
- Add an “Order via WhatsApp” button in the Reorder Suggestions tab.
- Use the supplier phone number saved with each product.
- Open WhatsApp with a pre-filled message:
```text
Hello, I would like to order 30 units of [Product Name]. Please confirm availability.
```
- If no supplier phone number is available, show a clear disabled state or warning.

UI/UX direction:
- Clean, minimal, modern dashboard style.
- Use tabs/navigation so the app does not feel like a single long page.
- Use clear cards, forms, tables, and badges.
- Use practical wording that small retailers understand:
  - Products
  - Stock In
  - Stock Out
  - Reorder Suggestions
- Use color-coded stock statuses:
  - Green: Safe
  - Yellow/Orange: Low
  - Red: Critical

Out of scope:
- No full ERP system.
- No authentication for now.
- No complex AI or machine learning.
- No separate supplier management module beyond storing supplier phone number per product.
