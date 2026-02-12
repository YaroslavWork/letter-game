# ------------------------------------------------------------------------------
# Stage 1: Build React frontend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Same-origin when served from Django on port 8000
ENV REACT_APP_API_URL=/api
ENV REACT_APP_WS_URL=ws://localhost:8000

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Django backend + serve frontend
# ------------------------------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install backend
COPY backend/ ./backend/

RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy frontend build into backend for SPA serving
COPY --from=frontend-builder /app/frontend/build ./backend/frontend_build

WORKDIR /app/backend

# Migrations and static check
RUN python manage.py migrate --noinput

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend.asgi:application"]
