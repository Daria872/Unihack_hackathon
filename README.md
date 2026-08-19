# Unilog AI

Hackathon prototype that enriches minimal industrial product information into standardized, validated, and evidence-backed product records. Includes a LangGraph-based Product Intelligence Chatbot.

## Stack

- Python
- FastAPI
- Pydantic
- LangGraph

## Project layout

```
backend/          FastAPI application
frontend/         UI (not implemented yet)
data/             Raw, reference, and ground-truth datasets
evaluation/       Evaluation scripts and reports
notebooks/        Exploration notebooks
docs/             Design and API notes
```

## Setup

```bash
cp .env.example .env
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run the API

From `backend/`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`

```json
{"status": "ok"}
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## Tests

From `backend/`:

```bash
pytest
```

Pipeline services and the chatbot are scaffolded under `backend/app/services/` and are not implemented yet.
