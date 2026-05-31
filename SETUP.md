# InsightPilot - Project Setup Guide

## Prerequisites

- **Python** 3.11+ (3.12 recommended)
- **Node.js** 18+ (with npm)
- **PostgreSQL** 15+
- **Git**

---

## Database Setup

1. Install PostgreSQL and ensure it's running.
2. Create the database:

```sql
CREATE DATABASE insightpilot;
```

Default connection string: `postgresql+asyncpg://postgres:root@localhost:5432/insightpilot`

---

## Backend Setup

```bash
cd backend
```

### 1. Create a virtual environment

```bash
python -m venv venv
```

### 2. Activate the virtual environment

**Windows:**
```cmd
venv\Scripts\activate
```

**Linux/macOS:**
```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the `backend/` directory:

```env
DEBUG=false
DATABASE_URL=postgresql+asyncpg://postgres:root@localhost:5432/insightpilot
SECRET_KEY=change-me-in-production
CORS_ORIGINS=["http://localhost:3000"]
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash-lite
```

| Variable | Description |
|----------|-------------|
| `DEBUG` | Enable debug mode (`true`/`false`) |
| `DATABASE_URL` | PostgreSQL async connection string |
| `SECRET_KEY` | JWT signing secret (change in production) |
| `CORS_ORIGINS` | Allowed frontend origins (JSON array) |
| `GEMINI_API_KEY` | Google Gemini API key for AI insights |
| `GEMINI_MODEL` | Gemini model to use |

### 5. Run database migrations

```bash
alembic upgrade head
```

### 6. Start the backend server

```bash
uvicorn app.main:app --reload
```

Or on Windows, use the provided script:
```cmd
run.cmd
```

The API will be available at **http://localhost:8000**  
API docs: **http://localhost:8000/api/v1/docs**

---

## Frontend Setup

```bash
cd frontend
```

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the `frontend/` directory:

```env
API_URL=http://localhost:8000/api/v1
```

### 3. Start the development server

```bash
npm run dev
```

The frontend will be available at **http://localhost:3000**

---

## Docker Setup (Backend Only)

To run the backend in Docker:

```bash
cd backend
docker build -t insightpilot-backend .
docker run -p 8000:8000 --env-file .env insightpilot-backend
```

---

## Running Both Together

1. Start PostgreSQL
2. In terminal 1 — start the backend:
   ```bash
   cd backend
   venv\Scripts\activate
   uvicorn app.main:app --reload
   ```
3. In terminal 2 — start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

Access the app at **http://localhost:3000**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Ant Design 6, Tailwind CSS 4, Recharts, AG Grid |
| Backend | FastAPI, SQLAlchemy (async), Pydantic v2, Alembic |
| Database | PostgreSQL (asyncpg) |
| AI | Google Gemini API |
| Auth | JWT (PyJWT + passlib/bcrypt) |

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `alembic upgrade head` | Apply all migrations |
| `alembic downgrade -1` | Rollback last migration |
| `alembic revision --autogenerate -m "msg"` | Generate new migration |
| `npm run build` | Build frontend for production |
| `npm run lint` | Lint frontend code |
