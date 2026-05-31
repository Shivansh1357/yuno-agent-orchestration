.PHONY: up down dev backend frontend test seed clean

# --- One-command Docker run (production-like, single origin :8000) ----------
up:
	@test -f .env || cp .env.example .env
	docker compose up --build

down:
	docker compose down

# --- Local dev (hot reload): backend on :8000, frontend on :5173 ------------
dev:
	@echo "Run these in two terminals:"
	@echo "  make backend   # FastAPI on http://localhost:8000"
	@echo "  make frontend  # Vite UI on http://localhost:5173"

backend:
	cd backend && \
	  (test -d .venv || python3 -m venv .venv) && \
	  .venv/bin/pip install -q -r requirements.txt && \
	  .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm install && npm run dev

test:
	cd backend && .venv/bin/python -m pytest -q

clean:
	rm -rf backend/data/*.db backend/.venv frontend/node_modules frontend/dist backend/static
