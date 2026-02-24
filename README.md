# Store Revenue Explorer

A small app to explore daily revenue across stores. You can filter by region and date, see whether each store is trending up or down (or uncertain) from expected revenue, and dig into the numbers.

## Stack

- **Frontend:** Vue 3, TypeScript, Vite, Tailwind v4, Pinia.
- **Charts:** ApexCharts, plus a small custom time-series SVG chart (see branch [custom-chart](https://github.com/jonnycolby/marketdial-take-home/tree/custom-chart)).
- **Backend:** Python 3.11, FastAPI.

## Prerequisites

- **Node:** 24 LTS is recommended.
- **Python:** 3.11.x (tested with 3.11.14).
  - On macOS with Homebrew: `brew install python@3.11`.
  - Check with `python3.11 --version`.

## Setup

**1) Clone the repo**

```bash
git clone https://github.com/jonnycolby/marketdial-take-home
cd marketdial-take-home
```

<br />

**2) Start the backend**

In a terminal, from the repo root:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Leave this running. The API will be at http://localhost:8000. You can confirm with http://localhost:8000/health.

<br />

**3) Start the frontend**

In a second terminal, go to the repo root (the `marketdial-take-home` directory you cloned), then:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser. The app will talk to the backend on port 8000 by default.

## Running tests

Backend tests (pytest):

```bash
cd backend
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
python3.11 -m pytest test_main.py -v
```

Install dependencies first if you haven’t (see Setup step 2). No frontend tests are included.

## Notes

The backend venv is Python 3.11 so the pinned deps stay compatible. After activation, `python` and `pip` refer to that venv; `python -m pip` is still the safest way to install so you don't accidentally use a different Python.

The app is set up to work with the default ports (backend 8000, frontend 5173). If you need to point the frontend at a different API host or port, set `VITE_API_BASE_URL` in `frontend/.env.local`.

## Custom Chart Library

I wanted to challenge myself and create my own sort of chart "library" to use instead of ApexCharts or another chart library -- you can find it at [https://github.com/jonnycolby/marketdial-take-home/tree/custom-chart](https://github.com/jonnycolby/marketdial-take-home/tree/custom-chart).
