# Nexora POS — Architecture Proposal (Analysis Phase, No Code Yet)

Source material: 3 reference screenshots (Login, Home/Outlet Dashboard, Management Dashboard) for tenant "Sri Maruthamalai Andavar". No Excel file was received — this analysis is built entirely from what is visible in those screens. Anything not visible in the screens is flagged under **Open Questions** at the end and should be confirmed before that part is built.

---

## 1. Module Inventory (from the sidebar)

| # | Module | Type | Notes from screenshots |
|---|--------|------|------------------------|
| 1 | Home | Dashboard | Outlet-level operational dashboard |
| 2 | Dashboard | Dashboard | Multi-outlet "Management Dashboard" (Head Office view) |
| 3 | Line Sale | Transaction | Likely the fast/POS billing screen |
| 4 | Sales Return | Transaction | Returns against a sale |
| 5 | Promotion | Master/Config | Discount/offer rules |
| 6 | Gift Voucher | Master/Transaction | Voucher issue & redemption |
| 7 | Loyalty | Master/Transaction | Points program |
| 8 | Customer | Master | Customer master + ledger |
| 9 | Sales Quotation | Transaction | Pre-sale document |
| 10 | Sales Order | Transaction | Confirmed order, pre-invoice |
| 11 | Sales Invoice | Transaction | Final billing document |
| 12 | Barcode & Label | Utility | Barcode/label generation & printing |
| 13 | Stock Indent | Transaction | Internal stock request |
| 14 | Stock Transfer | Transaction | Outlet-to-outlet movement |
| 15 | Stock Receipt | Transaction | Goods received (GRN) |
| 16 | Stock Return | Transaction | Return to supplier |
| 17 | Stock Wastage | Transaction | Damage/expiry write-off |
| 18 | Stock Count | Transaction | Physical stock count/reconciliation |
| 19 | Cashier Panel | Utility | Cash drawer / cashier operations |
| 20 | Shift Open | Transaction | Start of day/shift |
| 21 | Shift Close | Transaction | End of day/shift, reconciliation |
| 22 | Expenses Book | Transaction | Outlet expense entries |
| 23 | Reports | Reporting | Central reports module |
| 24 | Master Sync | Utility/Integration | Sync master data (likely HQ ↔ outlet or ERP) |
| 25 | Stock Sync | Utility/Integration | Sync stock data |
| 26 | SAP Sync | Utility/Integration | External ERP (SAP) integration, shows "Connected" status + last sync time |

Implied but not in the sidebar (present as top-bar or dashboard elements): **Outlet switching**, **global search**, **notifications**, **user/profile menu**, **Receivables/Payables view**, **Profitability report**.

---

## 2. Screens Analyzed in Detail

**Login** — multi-tenant branding (tenant name shown under the Nexora logo), Username, Password (show/hide), **Select Outlet** dropdown at login time, Remember me, Forgot Password, primary Login, and a secondary **Login with PIN** path (implies a fast cashier PIN-login mode alongside full username/password login). Marketing panel (feature highlights, product imagery, stat badges) is tenant-branding content, not functional.

**Home (outlet dashboard)** — scoped to one outlet (outlet selector in top bar). KPI cards: Total Sales (Today), Orders (Today), Total Items (active), Low Stock Items (count + link), Total Customers (+ % vs last month). A **Quick Access** grid duplicates every sidebar transaction module as a tile — this is a navigation aid, not a separate feature; it should reuse the same route/tile component, not a new one. Sales Overview line chart (period selector), Top Selling Items ranked list (period selector), Payment Summary donut (Cash/UPI/Card/Wallet/Credit), Recent Transactions table (Invoice No, Type, Customer, Amount, Time, Status), Low Stock Items table (Item, Current Stock, Reorder Level, Status).

**Management Dashboard (multi-outlet)** — scoped to the company (Head Office), with a date picker. KPI cards: Total Sales, Total Purchase, Gross Profit, Net Profit, Total Expenses (today), Stock Value. Sales Trend chart, Sales-by-Outlet donut, Payment Method donut. An operational-alerts row: Low Stock, Out of Stock, Pending Indents, Pending GRNs, Pending Transfers, Pending Approvals, SAP Sync Status. Top Selling Items table, Today's Outlet Performance table (Sales, Transactions, Avg Bill Value, Target vs Achievement %), Expense Summary (by category), Inventory Summary (donut: In Stock/Low Stock/Out of Stock/Blocked), Receivables & Payables panel, Profit Overview panel.

---

## 3. Master Data Entities (inferred)

Tenant/Company, Outlet, User, Role/Permission, Customer, Supplier, Item/Product, Item Category, Unit of Measure, Tax Rate, Price List, Promotion Rule, Gift Voucher Type, Loyalty Program/Tier, Expense Category, Payment Method, Document Number Series (per document type, per outlet).

## 4. Transaction / Document Entities (inferred)

Sales Quotation, Sales Order, Sales Invoice (incl. Line Sale/POS invoices), Sales Return, Stock Indent, Stock Transfer, Stock Receipt (GRN), Stock Return, Stock Wastage, Stock Count, Payment (against invoice), Expense Entry, Shift Session (open/close), Gift Voucher Transaction, Loyalty Transaction, Sync Log (Master/Stock/SAP).

## 5. Document Flow / Business Process Chains

- **Sales cycle:** Sales Quotation → Sales Order → Sales Invoice → (optional) Sales Return. Line Sale is the fast-path variant that likely skips Quotation/Order and creates an Invoice directly (POS counter behavior).
- **Procurement/replenishment cycle:** Stock Indent (request) → Stock Transfer (inter-outlet) or Stock Receipt (from supplier, i.e. GRN) → Stock Return (to supplier) if rejected.
- **Inventory integrity cycle:** Stock Count (physical count) → adjustment; Stock Wastage (write-off) — both should post to a common stock ledger, same as every other stock-moving document.
- **Cash cycle:** Shift Open → Cashier Panel transactions during shift → Shift Close (reconciliation) → feeds Expenses Book and Payment Summary.
- **Sync cycle:** Master Sync and Stock Sync appear to move data between outlets and Head Office (or a central server); SAP Sync moves data to/from an external ERP. These are integration jobs, not user transactions, and should sit behind an audit/log table.

Every module that changes stock (Sales Invoice, Sales Return, Stock Transfer, Stock Receipt, Stock Return, Stock Wastage, Stock Count) should write to one central **Stock Ledger** table rather than each module tracking quantity independently — this is what makes "Current Stock" on the dashboard trustworthy and auditable.

---

## 6. Reusable UI Component Inventory

Layout: `AppShell` (Sidebar + Topbar + content), `Sidebar`/`NavDrawer` (collapsible, mobile → overlay), `Topbar` (outlet selector, global search, notification bell, help, user menu), `PageHeader` (title + breadcrumbs + actions), `Breadcrumbs`.

Data display: `StatCard` (used identically across both dashboards), `QuickAccessGrid`/`QuickAccessTile`, `ChartCard` wrapping a line/area chart, `DonutChartCard` (with legend, used 3× per dashboard), `DataTable` (sortable, paginated, used for every list screen and every line-item grid), `StatusBadge` (Completed/Low Stock/Out of Stock/Connected, color-mapped by status), `ProgressBar` (Target vs Achievement), `EmptyState`, `LoadingState`, `ErrorState`.

Forms & inputs (RHF + Zod + MUI wrappers): `FormTextField`, `FormSelect`, `FormAutocomplete`, `FormDatePicker`/`FormDateRangePicker`, `FormCheckbox`, `FormSection`, `ProductSelector` (item search/autocomplete used in every transaction line), `CustomerSelector`, `SupplierSelector`, `OutletSelector`, `PaymentMethodSelector`, `DocumentNumberDisplay` (auto-generated doc numbers), `LineItemTable` (shared editable grid used by Quotation/Order/Invoice/Return/Indent/Transfer/Receipt/Wastage/Count — one component, configured per document type).

Feedback & overlays: `Modal`, `ConfirmDialog`, `Drawer`, `Tabs`, `Pagination`, `SearchBar` (global), `FilterBar`, `FileUpload`, `Toast`/`Snackbar` (via a notification/snackbar provider, not per-page state).

Auth: `LoginForm`, `PinLoginForm`.

---

## 7. Proposed Database Entities & Relationships (Prisma-level)

Core: `Tenant` 1—N `Outlet`; `Outlet` N—N `User` (via `UserOutlet`, since login lets a user pick an outlet); `Role` N—N `User`.

Catalog: `Item` N—1 `ItemCategory`; `Item` N—1 `UnitOfMeasure`; `Item` N—N `TaxRate` (or a rate snapshot per item); `PriceList` 1—N `PriceListItem` N—1 `Item`.

Party: `Customer`, `Supplier` (both tenant-scoped, optionally outlet-scoped).

Stock: `Stock` (Item × Outlet, current quantity — a derived/cached balance) fed by `StockLedgerEntry` (Item, Outlet, qty delta, source document type + id, timestamp) — every stock-moving document writes one or more ledger entries here.

Sales: `SalesQuotation`/`SalesOrder`/`SalesInvoice`/`SalesReturn`, each with a `*Line` child table (Item, Qty, Rate, Tax, Discount, LineTotal), each header referencing `Customer` and `Outlet`; `SalesInvoice` 1—N `Payment`.

Stock documents: `StockIndent`, `StockTransfer`, `StockReceipt`, `StockReturn`, `StockWastage`, `StockCount`, each with header + line tables, referencing `Outlet` (and `Supplier` for Receipt/Return).

Operational: `ShiftSession` (User, Outlet, opening/closing cash, status), `ExpenseEntry` N—1 `ExpenseCategory`, `Promotion`, `GiftVoucher` + `GiftVoucherTransaction`, `LoyaltyProgram` + `LoyaltyTransaction`.

Cross-cutting: `DocumentNumberSeries` (per doc type, per outlet, prefix + next number), `SyncLog` (type: Master/Stock/SAP, status, timestamp, payload/summary), `AuditLog`.

This is a first-pass entity list for planning the schema shape — the actual `schema.prisma` will be written when we start the relevant module, not all at once.

---

## 8. Module Dependency Map

1. **Foundation (build first, everything depends on it):** Tenant, Outlet, User, Role, auth.
2. **Master data:** Item/Category/UOM/Tax/PriceList, Customer, Supplier — required before any transaction module can be meaningfully tested.
3. **Sales documents** depend on: Item, Customer, PriceList, Promotion, Tax, DocumentNumberSeries.
4. **Stock documents** depend on: Item, Outlet, Supplier (Receipt/Return), and feed the shared Stock Ledger.
5. **Cashier Panel / Shift Open / Shift Close** depend on: User, Outlet, and (for reconciliation) Sales Invoice + Payment.
6. **Expenses Book** depends on: Outlet, ExpenseCategory, and feeds Shift Close reconciliation and the Management Dashboard's Expense Summary.
7. **Dashboards (Home, Management Dashboard)** are read-only aggregations over everything above — they can be scaffolded early with mock data, but their real numbers only become meaningful once Sales, Stock, and Expenses modules exist.
8. **Reports** depends on all transaction modules.
9. **Sync modules (Master Sync, Stock Sync, SAP Sync)** are integration utilities that depend on the full data model existing — naturally last.

---

## 9. Proposed Frontend Architecture (React + Vite + MUI + RTK Query)

```
frontend/
  src/
    app/                  # store.ts, hooks.ts (typed useAppDispatch/useAppSelector), App.tsx, routes.tsx
    api/                  # RTK Query: baseApi.ts + one injected endpoint file per domain
      baseApi.ts
      authApi.ts
      dashboardApi.ts
      itemApi.ts
      customerApi.ts
      supplierApi.ts
      salesApi.ts
      stockApi.ts
      ... (one per module, added as that module is built)
    features/             # redux slices for real global state only
      auth/authSlice.ts   # current user, token, selected outlet
      ui/uiSlice.ts        # sidebar collapsed, theme, snackbar queue
    components/
      layout/              # AppShell, Sidebar, Topbar, PageHeader, Breadcrumbs
      common/               # StatCard, DataTable, StatusBadge, ChartCard, DonutChartCard,
                             # ProgressBar, EmptyState, LoadingState, ErrorState, Modal,
                             # ConfirmDialog, Drawer, Tabs, Pagination, SearchBar, FilterBar,
                             # FileUpload, Toast
      form/                 # FormTextField, FormSelect, FormAutocomplete, FormDatePicker,
                             # FormCheckbox, FormSection, ProductSelector, CustomerSelector,
                             # SupplierSelector, OutletSelector, PaymentMethodSelector,
                             # DocumentNumberDisplay, LineItemTable
    modules/
      auth/                 # LoginPage, PinLoginPage
      dashboard/            # HomePage, ManagementDashboardPage
      items/ customers/ suppliers/ ...     # master data modules
      sales-quotation/ sales-order/ sales-invoice/ sales-return/ line-sale/
      stock-indent/ stock-transfer/ stock-receipt/ stock-return/ stock-wastage/ stock-count/
      promotion/ gift-voucher/ loyalty/
      cashier-panel/ shift/ expenses/
      reports/ master-sync/ stock-sync/ sap-sync/
      # each module folder: pages/, components/ (module-specific only), schema.ts (zod), types.ts
    theme/                 # MUI theme (palette, typography, breakpoints matching the reference)
    routes/                # route config, ProtectedRoute
    utils/
    constants/
  .env.example             # VITE_API_BASE_URL etc.
```

Rule of thumb enforced by this structure: a component only lives in `modules/<x>/components` if it is genuinely specific to that module and used nowhere else; anything used by 2+ modules belongs in `components/common` or `components/form`.

## 10. Proposed Backend Architecture (Node + Express + Prisma + PostgreSQL)

```
backend/
  prisma/
    schema.prisma          # built incrementally, module by module
    migrations/
  src/
    config/
      env.ts                # zod-validated environment variables, no hardcoded secrets
      db.ts                 # Prisma client singleton
      devAuth.ts             # isolated hardcoded dev credential (admin / Admin@123), clearly
                              # marked TEMPORARY, replaced later by DB-backed auth
    middleware/
      auth.ts errorHandler.ts validateRequest.ts
    modules/
      auth/ dashboard/ items/ customers/ suppliers/ sales/ stock/ promotions/
      gift-vouchers/ loyalty/ cashier/ shifts/ expenses/ reports/ sync/
      # each: <name>.routes.ts, <name>.controller.ts, <name>.service.ts, <name>.schema.ts (zod)
    utils/
    app.ts
    server.ts
  .env.example              # DATABASE_URL=, JWT_SECRET=, PORT=  (placeholders only, never real values)
```

All monetary/quantity totals (line totals, tax, invoice totals, stock balances) are computed and re-validated in the **service layer**, never trusted from the request body — the frontend sends inputs, the backend computes and returns authoritative totals.

## 11. Database Setup (no connection yet)

- `prisma/schema.prisma` scaffolded with `datasource db { provider = "postgresql", url = env("DATABASE_URL") }` and models added incrementally per module.
- `DATABASE_URL` read only from environment variables (`.env`, untracked; `.env.example` tracked with a placeholder).
- No migration or `prisma db push`/`prisma migrate` is run until you provide the real connection string.

## 12. Auth for Phase 1

- One hardcoded dev credential (`admin` / `Admin@123`), isolated in `backend/src/config/devAuth.ts`, clearly commented as temporary.
- No PostgreSQL credentials, JWT secrets, or API keys are hardcoded anywhere — those go through environment variables even in dev, with `.env.example` documenting the expected keys and no real values committed.
- Login screen still shows Outlet selection and (stubbed) PIN login, matching the reference, even though only one credential works for now.

## 13. Responsive Design Approach

MUI breakpoint system (`xs/sm/md/lg/xl`) throughout: `Sidebar` becomes an overlay drawer below `md`; the Topbar's search/notification cluster collapses into an icon-triggered overlay on small screens; KPI `StatCard` grids reflow from 6/5-across to 2-across to 1-across; dashboard charts and donut legends stack vertically on mobile; `DataTable` gets horizontal scroll (`overflow-x: auto`) on narrow viewports rather than being redesigned; touch targets sized for tablet/mobile POS use at the counter, since this is a POS system likely also run on tablets.

---

## 14. Assumptions & Open Questions (please confirm before we build the related module)

1. **Line Sale vs Sales Invoice:** is Line Sale a distinct fast-POS document type, or does it just create a Sales Invoice with a different UI? This affects whether they share one backend document type or two.
2. **Sales Quotation → Order → Invoice conversion:** should each stage support "convert to next stage" (copying lines forward), and can Invoice be created without a prior Quotation/Order (i.e., is the chain optional)?
3. **Multi-outlet stock:** does each outlet hold independent stock (transfers required to move it) — confirmed by the Stock Transfer module — but should there also be a company-wide "virtual" stock view, or is Head Office view just a sum across outlets (as the Management Dashboard suggests)?
4. **Master Sync / Stock Sync:** sync between what — Head Office ↔ Outlets, or this app ↔ an external system distinct from SAP? Direction (push/pull/both) and what "connected" status monitors.
5. **SAP integration:** which SAP module/API (e.g. SAP B1, S/4HANA OData) and what entities sync (items, stock, invoices, customers)? Needed before the SAP Sync module is designed.
6. **User roles/permissions:** only "Super Admin" is shown. What other roles exist (Cashier, Outlet Manager, Store Staff) and what should each be restricted from?
7. **PIN login:** is this a numeric PIN tied to the same user, used for quick cashier re-authentication mid-shift (common in POS), or a fully separate login path?
8. **Promotion/Loyalty rule complexity:** simple (flat % off, buy-X-get-Y) or rule-engine-level (tiered, combinable, date-bound)? Affects schema and UI complexity significantly.
9. **Gift Voucher:** physical/printed code-based, or purely digital-balance based?
10. **Currency/locale:** confirmed as INR (₹) from the screenshots — any multi-currency requirement, or single-currency is fine?

---

## 15. Suggested Build Order (proposal only — not starting until you say go)

1. Project scaffolding: Vite + MUI theme + Redux store + RTK Query base + Express + Prisma skeleton + dev auth + base layout (Sidebar/Topbar) + the core reusable component library (StatCard, DataTable, StatusBadge, forms, etc.)
2. Master data modules: Outlet, User/Role, Item (+Category/UOM/Tax), Customer, Supplier
3. Home dashboard + Management Dashboard (wired to real endpoints, even if data is sparse initially)
4. Sales cycle: Line Sale → Sales Invoice → Sales Quotation/Order → Sales Return
5. Stock cycle: Stock Receipt → Stock Transfer → Stock Indent → Stock Return → Stock Wastage → Stock Count → Barcode & Label
6. Promotion, Gift Voucher, Loyalty
7. Cashier Panel, Shift Open/Close, Expenses Book
8. Reports
9. Master Sync, Stock Sync, SAP Sync

This document is a proposal for review — no code has been written. Once you confirm the open questions and the build order, tell me which module to start with and I'll implement it in isolation, inspecting/reusing existing code as it grows.
