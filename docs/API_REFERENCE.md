# API Reference

The full, testable reference is the OpenAPI file [`backend/docs/openapi.yaml`](../backend/docs/openapi.yaml),
served as Swagger UI at **http://localhost:5000/api/docs** (raw JSON: `/api/docs.json`).
Swagger UI is on outside production; set `ENABLE_API_DOCS=true` to serve it in production too.
A test (`tests/integration/docs.test.js`) fails when a route is added to the code without being documented.

Base URL: `/api/v1`

## Conventions

- **Envelope:** every answer is `{ success, message, data, meta }`. Errors have `success: false`,
  `data: null` and, for validation errors, `errors: [{ field, message }]`. `EMAIL_NOT_VERIFIED` is the only `code` (403 on login).
- **Money is a string** with 2 decimals (`"12.50"`), summed in SQL. Amounts are never converted between
  currencies; reports use `?currency=` or the profile currency.
- **Dates** are `YYYY-MM-DD` (UTC days).
- **Pagination:** `?page=1&limit=20` (max 100) gives `meta: { total, page, limit, totalPages, hasNext, hasPrev }`.
  Expenses and incomes add `meta.totalAmount`, notifications are plain lists with `/unread-count`,
  dashboard and reports add `meta.availableCurrencies`.
- **Auth:** `Authorization: Bearer <accessToken>` (15 min). The refresh token is an httpOnly cookie
  `refreshToken` (path `/api/v1/auth`, single use, rotated on each refresh).
- **Rate limits:** 300 per 15 min per IP overall, 10 per 15 min on auth endpoints (one shared counter),
  a tenth of the overall limit on exports. 429 when exceeded. Counters are in memory.
- **Downloads** (receipts, exports) are binary. Fetch them with the API client as a blob and read the
  file name from `Content-Disposition`.
- **Notification types:** `budget_warning`, `budget_exceeded`, `recurring_created`, `weekly_summary`, `system`.
- Create/update bodies are strict: unknown fields answer 400.

## Endpoints

### Health

| Method | Path      | Summary      | Login |
| ------ | --------- | ------------ | ----- |
| GET    | `/health` | Health check | no    |

### Auth

| Method | Path                        | Summary                               | Login |
| ------ | --------------------------- | ------------------------------------- | ----- |
| POST   | `/auth/register`            | Create an account                     | no    |
| POST   | `/auth/verify-email`        | Confirm the emailed code              | no    |
| POST   | `/auth/resend-verification` | Send a new verification code          | no    |
| POST   | `/auth/login`               | Log in                                | no    |
| POST   | `/auth/refresh`             | Get a new access token                | no    |
| POST   | `/auth/logout`              | Log out                               | no    |
| POST   | `/auth/forgot-password`     | Request a password reset link         | no    |
| POST   | `/auth/reset-password`      | Set a new password with a reset token | no    |

### Users

| Method | Path                 | Summary            | Login |
| ------ | -------------------- | ------------------ | ----- |
| GET    | `/users/me`          | Get my profile     | yes   |
| PUT    | `/users/me`          | Update my profile  | yes   |
| DELETE | `/users/me`          | Delete my account  | yes   |
| PUT    | `/users/me/password` | Change my password | yes   |
| POST   | `/users/me/avatar`   | Upload my avatar   | yes   |

### Categories

| Method | Path               | Summary                  | Login |
| ------ | ------------------ | ------------------------ | ----- |
| GET    | `/categories`      | List categories          | yes   |
| POST   | `/categories`      | Create a custom category | yes   |
| GET    | `/categories/{id}` | Get a category           | yes   |
| PUT    | `/categories/{id}` | Update a custom category | yes   |
| DELETE | `/categories/{id}` | Delete a custom category | yes   |

### Accounts

| Method | Path                       | Summary                             | Login |
| ------ | -------------------------- | ----------------------------------- | ----- |
| GET    | `/accounts`                | List accounts                       | yes   |
| POST   | `/accounts`                | Create an account                   | yes   |
| GET    | `/accounts/transfers`      | List transfers                      | yes   |
| POST   | `/accounts/transfers`      | Transfer money between two accounts | yes   |
| GET    | `/accounts/{id}`           | Get an account                      | yes   |
| PUT    | `/accounts/{id}`           | Update an account                   | yes   |
| DELETE | `/accounts/{id}`           | Delete an account                   | yes   |
| POST   | `/accounts/{id}/archive`   | Archive an account                  | yes   |
| POST   | `/accounts/{id}/unarchive` | Restore an archived account         | yes   |

### Expenses

| Method | Path                     | Summary                       | Login |
| ------ | ------------------------ | ----------------------------- | ----- |
| GET    | `/expenses`              | List expenses                 | yes   |
| POST   | `/expenses`              | Add an expense                | yes   |
| GET    | `/expenses/{id}`         | Get an expense                | yes   |
| PUT    | `/expenses/{id}`         | Update an expense             | yes   |
| DELETE | `/expenses/{id}`         | Delete an expense             | yes   |
| GET    | `/expenses/{id}/receipt` | Download the receipt          | yes   |
| POST   | `/expenses/{id}/receipt` | Upload or replace the receipt | yes   |
| DELETE | `/expenses/{id}/receipt` | Remove the receipt            | yes   |

### Incomes

| Method | Path            | Summary          | Login |
| ------ | --------------- | ---------------- | ----- |
| GET    | `/incomes`      | List incomes     | yes   |
| POST   | `/incomes`      | Add an income    | yes   |
| GET    | `/incomes/{id}` | Get an income    | yes   |
| PUT    | `/incomes/{id}` | Update an income | yes   |
| DELETE | `/incomes/{id}` | Delete an income | yes   |

### Budgets

| Method | Path            | Summary                     | Login |
| ------ | --------------- | --------------------------- | ----- |
| GET    | `/budgets`      | List the budgets of a month | yes   |
| POST   | `/budgets`      | Create a budget             | yes   |
| GET    | `/budgets/{id}` | Get a budget                | yes   |
| PUT    | `/budgets/{id}` | Update a budget             | yes   |
| DELETE | `/budgets/{id}` | Delete a budget             | yes   |

### Recurring

| Method | Path                     | Summary                     | Login |
| ------ | ------------------------ | --------------------------- | ----- |
| GET    | `/recurring`             | List recurring templates    | yes   |
| POST   | `/recurring`             | Create a recurring template | yes   |
| GET    | `/recurring/{id}`        | Get a recurring template    | yes   |
| PUT    | `/recurring/{id}`        | Update a recurring template | yes   |
| DELETE | `/recurring/{id}`        | Delete a recurring template | yes   |
| POST   | `/recurring/{id}/pause`  | Pause a template            | yes   |
| POST   | `/recurring/{id}/resume` | Resume a template           | yes   |

### Dashboard

| Method | Path                 | Summary                        | Login |
| ------ | -------------------- | ------------------------------ | ----- |
| GET    | `/dashboard/summary` | Dashboard cards for one period | yes   |
| GET    | `/dashboard/trends`  | Income and expense over time   | yes   |

### Reports

| Method | Path                   | Summary                                         | Login |
| ------ | ---------------------- | ----------------------------------------------- | ----- |
| GET    | `/reports/monthly`     | Monthly report                                  | yes   |
| GET    | `/reports/yearly`      | Yearly report                                   | yes   |
| GET    | `/reports/by-category` | Totals per category for a date range            | yes   |
| GET    | `/reports/by-account`  | Income and expense per account for a date range | yes   |

### Notifications

| Method | Path                          | Summary                        | Login |
| ------ | ----------------------------- | ------------------------------ | ----- |
| GET    | `/notifications`              | List notifications             | yes   |
| GET    | `/notifications/unread-count` | Number of unread notifications | yes   |
| PUT    | `/notifications/read-all`     | Mark all notifications as read | yes   |
| PUT    | `/notifications/{id}/read`    | Mark one notification as read  | yes   |

### Exports

| Method | Path                | Summary                              | Login |
| ------ | ------------------- | ------------------------------------ | ----- |
| GET    | `/exports/expenses` | Export expenses as CSV, Excel or PDF | yes   |
