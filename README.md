# Unilog AI — Product Intelligence Platform

An enterprise AI platform that enriches minimal catalog inputs into standardized, evidence-grounded, and validated 252-column product master data. Includes a **LangGraph Enrichment Engine**, **Docling PDF Document Processor**, **Qdrant Vector Database**, **Gemini 2.5 Structured Attribute Extractor**, **Product Intelligence Chatbot**, and a **React Executive Dashboard**.

---

## Architecture Overview

```
                  ┌────────────────────────────────────────┐
                  │          React Frontend UI             │
                  │   (Dashboard, Explorer, QnA Chatbot)   │
                  └───────────────────┬────────────────────┘
                                      │ REST API / SSE
                                      ▼
                  ┌────────────────────────────────────────┐
                  │             FastAPI Backend            │
                  └───────────────────┬────────────────────┘
                                      │
       ┌──────────────────────────────┴──────────────────────────────┐
       ▼                                                             ▼
┌──────────────────────────────┐                         ┌───────────────────────┐
│ LangGraph Enrichment Engine  │                         │ Product QnA Chatbot   │
│  1. Resolve Product          │                         │  1. Classify Intent   │
│  2. Retrieve Evidence        │                         │  2. Identify Product  │
│  3. Extract Attributes       │                         │  3. Retrieve Evidence │
│  4. Verify Grounding         │                         │  4. Generate Answer   │
│  5. Check Confidence         │                         │  5. Verify Grounding  │
│  6. LOV Validation           │                         └───────────┬───────────┘
│  7. UOM Normalization        │                                     │
│  8. Description Generation   │                                     │
│  9. Final Validation (CRAG)  │                                     │
│ 10. 252-Column Assembly      │                                     │
└──────────────┬───────────────┘                                     │
               │                                                     │
               └──────────────────────┬──────────────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │    Qdrant Hybrid Retrieval   │
                       │    Docling PDF Ingestion     │
                       │   Gemini 2.5 Flash LLM       │
                       └──────────────────────────────┘
```

---

## Key Features

1. **Document Intelligence Ingestion**: Uses **Docling** for structured PDF extraction (tables, text, metadata) with robust PyPDF fallbacks.
2. **Hybrid Retrieval (Qdrant)**: Embeds document chunks into an in-memory Qdrant vector database for semantic & MPN-filtered retrieval.
3. **Structured Gemini Extraction**: Extracts technical attributes with exact ground evidence, confidence scores, and source citations without inventing values.
4. **LangGraph CRAG / Self-RAG Flow**: Automated multi-attempt corrective retrieval loop for failing attributes, escalating to `NEEDS_HUMAN_REVIEW` after 2 failures.
5. **Taxonomy & UOM Normalization**: Deterministic validation against Unilog List of Values (LOV), fraction-inch conversions, and standard units (`V`, `A`, `dBA`, `in`).
6. **252-Column Delivery Format**: Outputs valid Excel (`.xlsx`) files matching the required delivery headers.
7. **React Executive Dashboard**: Real-time batch job monitoring, live log stream, product catalog explorer, human review queue, and grounding evidence viewer.

---

## Setup & Local Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Environment Configuration
Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_google_gemini_api_key
```

### 2. Backend Installation
```bash
cd backend
python -m venv .venv

# On Windows PowerShell:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Frontend Build
```bash
cd frontend
npm install
npm run build
```

---

## Running the Application

### Method A: Monolithic FastAPI Mode (Production / Single Server)
Build the frontend, then start FastAPI to serve both API routes and static frontend bundle from `http://localhost:8000`:
```bash
# Build frontend static files
cd frontend
npm run build

# Run FastAPI backend
cd ../backend
uvicorn app.main:app --reload --port 8000
```
Open **`http://localhost:8000`** in your browser.

### Method B: Development Mode (Hot-Reloading UI)
Run backend and frontend dev servers in separate terminal tabs:

- **Terminal 1 (Backend API)**:
  ```bash
  cd backend
  uvicorn app.main:app --reload --port 8000
  ```

- **Terminal 2 (Vite Frontend)**:
  ```bash
  cd frontend
  npm run dev
  ```
Open **`http://localhost:5173`** in your browser.

---

## Testing & Quality Assurance

Run the comprehensive pytest suite covering ingestion, Qdrant retrieval, Gemini extraction, LangGraph workflow execution, and chatbot QnA:

```bash
cd backend
pytest -v
```

**Test Coverage Highlights**:
- `test_document_intelligence.py`: PDF extraction & Qdrant hybrid retrieval
- `test_langgraph_workflow.py`: Full node execution flow, CRAG retry loops, and human-review fallback paths
- `test_pipeline.py`: End-to-end catalog job processing & chatbot intent routing

---

## Running Evaluation Against Ground Truth

To evaluate the pipeline against the 200-item ground-truth delivery dataset:

```bash
python evaluation/evaluate.py
```

This generates **`evaluation/eval_report.json`** summarizing:
- Overall Cell Accuracy
- Attribute Accuracy
- LOV & UOM Compliance Rates
- Description Character-Limit Compliance
- Missing Field Rate
- Evidence-Backed Grounding Rate
- Human-Review Rate

---

## Project Structure

```
unilog-product-intelligence/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI endpoints (pipeline, chatbot, health)
│   │   ├── models/          # Pydantic schemas & ProductInput definitions
│   │   ├── services/
│   │   │   ├── chatbot/     # LangGraph Chatbot flow & intent classifier
│   │   │   ├── enrichment/  # 10-node LangGraph enrichment state graph
│   │   │   ├── extraction/  # Gemini 2.5 Flash attribute extractor
│   │   │   ├── ingestion/   # Docling PDF processor & Excel reader
│   │   │   ├── retrieval/   # Qdrant vector database & reference lookup
│   │   │   └── validation/  # LOV/UOM deterministic validation rules
│   │   └── main.py          # FastAPI application entrypoint
│   ├── tests/               # Pytest test suite (22/22 passing)
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/                 # React UI components & Tailwind/CSS styles
│   ├── dist/                # Production UI build folder
│   └── package.json
├── data/                    # Raw input files & reference taxonomies
├── evaluation/              # Benchmark evaluator & output reports
└── README.md
```
