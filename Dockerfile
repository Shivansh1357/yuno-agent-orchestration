# syntax=docker/dockerfile:1
# ----------------------------------------------------------------------------
# Multi-stage build: compile the React frontend, then serve it from the Python
# backend as a single origin. One image, one container, one command.
# ----------------------------------------------------------------------------

# --- Stage 1: build the frontend -------------------------------------------
FROM node:20-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: the backend (also serves the built frontend) -----------------
FROM python:3.12-slim AS backend
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# Drop the compiled SPA where FastAPI looks for it (backend/static -> /app/static).
COPY --from=frontend /frontend/dist ./static

RUN mkdir -p /app/data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
