# ReimburSync — Expense Reimbursement Management System

![Django](https://img.shields.io/badge/Django-4.x-092E20?style=for-the-badge&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

## Overview
ReimburSync is a comprehensive, multi-tenant expense reimbursement platform that allows companies to streamline how employee expenses are logged, reviewed, and approved. It solves the delay and complexity of manual expense approvals by providing robust conditional logic, currency conversions, and role-based workflows in an intuitive tracking dashboard.

## Demo Credentials
After seeding demo data (see Setup section), use these accounts to explore the system:

| Role | Email | Password |
|---|---|---|
| Admin | admin@acme.com | Admin1234 |
| Manager | manager@acme.com | Manager1234 |
| Employee | john@acme.com | Employee1234 |
| Employee | priya@acme.com | Employee1234 |

## Tech Stack
| Layer | Technology | Purpose |
| --- | --- | --- |
| **Backend** | Django & Django REST Framework (DRF) | Core business logic, API endpoints, and authentication |
| **Database** | PostgreSQL | Relational data persistence, Django ORM integrations |
| **Frontend** | React (Vite) + Tailwind CSS v4 | Interactive UI, seamless state management, component isolation |
| **State/Data**| AuthContext & Axios | JWT token propagation and React context for authorization |
| **OCR** | pytesseract + Pillow | Receipt image scanning and data extraction |
| **Currency** | restcountries.com + exchangerate-api.com | Country lookups and live exchange rate conversion |
| **Containerization** | Docker & Docker Compose | Containerized environments for reproducible, easy setups |

## Features
- **Role-Based Access Control (RBAC):** Distinct roles (Employee, Manager, Admin) determining dashboard scope and capabilities.
- **Dynamic Approval Engine:** Configure sequential, percentage-based, user-specific, or hybrid approval workflows natively.
- **Currency Support & Auto-Conversion:** Built-in ISO 4217 validation and automatic normalization of global currencies into company defaults.
- **Receipt OCR Scanning:** Upload a receipt image and the system automatically extracts amount, date, merchant name, and category using OCR — pre-filling the expense form.
- **Real-Time Dashboards:** Real-time data aggregation via Django ORM returning tailored actionable indicators per role.
- **Strict Data Validation:** Comprehensive server-side checks covering valid currencies, exact dates, descriptive content length, and business-logic validation. Frontend validation provides immediate feedback before API calls.
- **Secure Authentication:** JWT-based stateless authentication preventing unauthorized workflow interference.

## Architecture
The application is structured into decoupled components prioritizing clean code and separation of concerns. The Django backend drives data via modular apps (`accounts` for RBAC, `expenses` for request ledgers, `approvals` for processing rules, and `ocr` for receipt scanning). The frontend consumes these using Axios interceptors wrapped inside a React SPA, safeguarded by Context-driven `RoleGuard` conditional rendering and tailored API views.

## Database Design
| Model | Key Fields | Relationships & Purpose |
| --- | --- | --- |
| **Company** | id, name, country, currency | Groups users and standardized currencies. |
| **User** | email, name, role, is_manager_approver | Extends `AbstractBaseUser`. FK to `Company`, Self-referential `manager` FK. |
| **Expense** | amount, currency, category, status | Core unit of work. FK to `User` (submitted_by). Handled via strict creation bounds. |
| **ApprovalRule**| name, rule_type, threshold, specific_approver | FK to `Company`. Defines conditions like Percentage, Sequential, Hybrid. |
| **ApprovalStep**| step_order | FK to `ApprovalRule` and `User`. Defines the chain of custody. |
| **ApprovalRequest**| status, comment, acted_at | FK to `Expense`, `User`, `ApprovalStep`. The active audit trail. |

## Approval Workflow
Our logic engine supports 4 configurable rule architectures to fit any business:
- **Sequential:** Expenses must clear a predefined chain (e.g., specific manager, then regional head) in exact order.
- **Percentage:** Engages an arbitrary number of rule delegates, requiring X% threshold to auto-approve.
- **Specific Approver:** Overrides standard hierarchies; directly pings a singular authoritative user (e.g., CFO).
- **Hybrid:** A blend of methods — either a percentage threshold **or** a specific approver's decision triggers auto-approval.

## API Endpoints

| Method | Endpoint | Auth | Role |
|---|---|---|---|
| POST | `/api/auth/signup/` | No | Public |
| POST | `/api/auth/login/` | No | Public |
| POST | `/api/auth/refresh/` | No | Public |
| GET | `/api/countries/` | No | Public |
| GET/POST | `/api/users/` | JWT | Admin |
| PATCH | `/api/users/<uuid>/` | JWT | Admin |
| GET/POST | `/api/expenses/` | JWT | Scoped by role |
| GET | `/api/expenses/stats/` | JWT | Scoped by role |
| GET | `/api/expenses/<uuid>/` | JWT | Scoped by role |
| GET | `/api/currency/convert/` | JWT | Authenticated |
| GET | `/api/approvals/pending/` | JWT | Manager/Admin |
| POST | `/api/approvals/<uuid>/decide/` | JWT | Manager/Admin |
| GET/POST | `/api/rules/` | JWT | Admin |
| PATCH | `/api/rules/<uuid>/` | JWT | Admin |
| POST | `/api/ocr/scan/` | JWT | Authenticated |

## Key Design Decisions

- **is_manager_approver flag**: When enabled on a user, their direct manager always reviews the expense first — before any rule-based approvers kick in. This mirrors real-world corporate hierarchies.
- **Company-scoped everything**: Every model query filters by the logged-in user's company. A user from Company A can never see Company B's data — enforced at the ORM level, not just the UI.
- **Approval engine isolation**: The entire workflow logic lives in `approvals/engine.py` — a single file with pure functions. This makes it independently testable and easy to extend with new rule types.
- **Dual validation strategy**: Validation runs twice — on the frontend for immediate UX feedback, and on the backend serializers as the source of truth. Frontend validation never replaces server-side checks.
- **Currency stored twice**: Expenses store both the original currency/amount AND the converted company-currency amount. This ensures managers always see comparable numbers regardless of what currency the employee submitted in.

## Security Considerations
- JWT access tokens are short-lived; refresh tokens are stored securely
- All expense and user queries are company-scoped — users cannot access data from other companies
- Role-based permission classes enforce access at the API layer
- Input validation runs on both the frontend (immediate feedback) and backend (server-side enforcement)
- Passwords are hashed using Django's PBKDF2 algorithm — never stored in plain text
- CORS is restricted to the frontend origin only

## Setup & Running
### Prerequisites
- Docker & Docker Compose
- Node.js & npm (for Local/Non-Docker Frontend)
- Python 3.11+ (for Local/Non-Docker Backend)

### Environment Variables
Duplicate the sample environment configurations in your root level:
- Ensure `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` match your Postgres containers.
- Django sets configuration natively from `.env`.

### Running with Docker
The easiest and recommended way:
```bash
docker compose up --build
```
This spins up PostgreSQL, applies Django migrations, and mounts the React proxy bindings all on `localhost`.

- **Backend** → `http://localhost:8000`
- **Frontend** → `http://localhost:5173`
- **Database** → `localhost:5432`

Seed demo data (optional, after containers are running):
```bash
# In a new terminal tab, after containers are running:
docker compose exec backend python manage.py seed_demo
```

### Running without Docker
**Backend:**
1. Navigate to `backend/`.
2. Run `pip install -r requirements.txt`.
3. Configure DB bindings on localhost and run `./manage.py migrate`.
4. Run server: `python manage.py runserver 0.0.0.0:8000`.

**Frontend:**
1. Navigate to `frontend/`.
2. Run `npm install`.
3. Run dev server: `npm run dev`.

## Project Structure
```text
.
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/ (Django settings, urls, wsgi)
│   └── apps/
│       ├── accounts/ (Users, Companies, Permissions)
│       ├── approvals/ (Rule schemas and approval engine)
│       ├── expenses/ (Transactions, stats & currency utils)
│       └── ocr/ (Receipt scanning via pytesseract)
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── api/ (Axios instance with JWT interceptors)
│   │   ├── components/ (Navbar, RoleGuard, StatusBadge, Timeline)
│   │   ├── context/ (AuthContext — JWT persistence)
│   │   └── pages/ (Login, Signup, Dashboard, SubmitExpense,
│   │               ExpenseHistory, ApprovalQueue, AdminUsers,
│   │               ManageRules)
└── docker-compose.yml
```
