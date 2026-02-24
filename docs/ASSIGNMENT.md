# Full Stack Take home assignment

## Project Description

Build a small full stack application that allows a user to explore daily revenue performance for a set of stores.

The goal is to present a dataset in a way that is clear, fast, and trustworthy. Users should be able to filter and page through results, and quickly understand whether revenue changes appear meaningful or uncertain.

This project is intentionally scoped to be completable in **\~2 hours**.

## Requirements

### Backend (Python API)

Create a small API using **FastAPI (preferred)** or Flask.

The API should load data from a local file (we will provide a JSON file).

### Endpoints

**1) GET /health**

Returns:

```json
{ "ok": true }
```

<br />

**2) GET /results**

Returns store-level daily results with support for:

- Filtering:

  - region

  - store\_id

  - start\_date

  - end\_date

- Pagination:

  - page (default 1)
  
  - page\_size (default 25, max 200)

Response format:

```json
{
    "page": 1,
    "page_size": 25,
    "total": 500,
    "results": [ ... ]
}
```

<br />

**3) GET /summary**

Returns summary information for the current filters (same filters as /results), such as:

- total matching rows

- average delta

- min/max delta

- percent of rows considered "uncertain" (CI crosses 0)

- breakdown counts by region

Example:

```json
{
    "total": 500,
    "delta": { "min": -1200, "max": 2400, "avg": 143.2 },
    "uncertain_rate": 0.32,
    "regions": [
        { "region": "West", "count": 120 },
        { "region": "East", "count": 90 }
    ]
}
```

---

### Frontend (Vue 3 + TypeScript)

Create a frontend app using **Vue 3 + TypeScript** (Vite preferred).

The UI should include:

### Filters

- Region dropdown

- Store ID filter (text input is fine)

- Date range filter

- Button to apply filters (or reactive updates—your choice)

### Results Table

A table showing:

- store\_id

- region

- date

- baseline\_revenue

- actual\_revenue

- delta

- confidence interval (ci\_low to ci\_high)

- transactions

<br />

The table must support:

- pagination controls (next/prev or page selector)

- loading state

- empty state

- error state

### Uncertainty Indicator

If the confidence interval crosses 0 (ci\_low < 0 < ci\_high), the UI should clearly indicate the row is **uncertain** (badge/icon/text is fine).

### Chart

Add one simple visualization (your choice), such as:

- average delta over time

- average delta by region

- actual revenue trend over time

Any charting library is fine.

### Formatting Expectations

Revenue fields should be displayed clearly as currency: \$12,340.50

delta should show sign: +\$320.12 or -\$50.00

## Nice to Haves

These are optional, but encouraged:

- Unit tests (backend and/or frontend)

- Sorting (e.g., sort by delta descending)

- "Show uncertain only" toggle

- Row detail view (modal/drawer) when clicking a store result

- Clean state management approach (Pinia or composables)

- Thoughtful handling of edge cases (missing values, zero baseline, etc.)

- **Docker support**

  - A docker-compose.yml that starts the full app stack

  - A Postgres container seeded with the provided dataset

  - The backend serving results from Postgres instead of reading directly from a JSON file

  - Clear README instructions for running the project via Docker

## Instructions

### Time Expectation

Please aim to spend **no more than \~2 hours** on this project.

We care more about clean structure, clarity, and correctness than about adding tons of features.

### Submission

Upload your solution to a GitHub repo (public or private)

Email us the repo URL

### README Required

Your repo **must include a README** with clear instructions for how we can run the project locally.

Your README should include:

- prerequisites (Node/Python versions)

- how to install dependencies

- how to run backend

- how to run frontend

- how to run tests (if included)

### Local Setup Options

You may use any approach that makes setup easy, such as:

- Python virtual environments

- Docker / docker-compose

The only requirement is that we can follow the README and run the app without guesswork.

## What We're Evaluating

We will focus on:

- Code clarity and organization

- Accurate instructions for running the project

- API design

- UI clarity and usability

- Thoughtfulness of tradeoffs

- Maintainability and simplicity

- Testing approach

