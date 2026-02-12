# Letter Game

A multiplayer word game where players join rooms, receive a letter each round, and submit answers for categories (e.g. Country, City, Animal) that start with that letter. Built with a **Django REST Framework + Django Channels** backend (REST API + WebSockets) and a **React** frontend.

## 📋 Table of Contents

- [Features](#-features)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [Running with Docker](#-running-with-docker)
- [Getting Started](#-getting-started)
- [Dependencies](#-dependencies)
- [API Endpoints](#-api-endpoints)
- [WebSockets](#-websockets)
- [Troubleshooting](#-troubleshooting)

## ✨ Features

- **User accounts**: Registration, login, and JWT-based auth with token refresh
- **Rooms**: Host creates a room; others join via room ID. Real-time player list and updates
- **Game rules**: Choose letter (fixed or random), categories (Country, City, Name, Animal, etc.), number of rounds, and round timer
- **Rounds**: Each round uses a letter; players submit one answer per category starting with that letter
- **Scoring**: Points per category, total per round, and optional “reduce timer when someone completes all categories”
- **Real-time updates**: WebSockets for room updates, game start, player submissions, removals, and room deletion
- **Multi-language**: English, Polish, Ukrainian
- **Responsive UI**: Timer, answer form, results table, confirmation dialogs, notifications

## 📁 Project Structure

```
letter-game/
├── Dockerfile                       # Multi-stage: Node build + Python/Daphne
├── .dockerignore
├── backend/                         # Django API + WebSockets
│   ├── api/                         # Main API app
│   │   ├── migrations/              # DB migrations
│   │   ├── serializers/             # DRF serializers
│   │   │   ├── game_session_serializer.py
│   │   │   ├── jwt_serializer.py
│   │   │   ├── player_answer_serializer.py
│   │   │   ├── register_serializer.py
│   │   │   ├── room_serializer.py
│   │   │   └── user_serializer.py
│   │   ├── views/                   # API views
│   │   │   ├── game_session_view.py
│   │   │   ├── login_view.py
│   │   │   ├── me_view.py
│   │   │   ├── register_view.py
│   │   │   └── room_view.py
│   │   ├── consumers.py             # WebSocket consumer (room/game events)
│   │   ├── routing.py               # WebSocket URL routing
│   │   ├── models.py                # Room, GameSession, PlayerAnswer, etc.
│   │   └── urls.py                  # REST URL routing
│   ├── backend/                     # Django project
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py                  # ASGI app (Daphne)
│   │   └── wsgi.py
│   ├── tests/                       # Pytest API tests
│   ├── manage.py
│   ├── requirements.txt
│   ├── run_asgi_server.bat          # Windows: run Daphne
│   └── run_asgi_server.sh           # Linux/Mac: run Daphne
│
└── frontend/                        # React SPA
    ├── public/
    ├── src/
    │   ├── components/UI/           # AnswerForm, GameTimer, ResultsTable, etc.
    │   ├── contexts/                # Auth, Language, Notification, Confirmation
    │   ├── features/api/            # API client
    │   ├── features/hooks/          # useGameState, useAnswerForm, useRoundManagement, etc.
    │   ├── lib/                     # axios.js, websocket.js
    │   ├── locales/                 # en, pl, uk
    │   └── pages/                   # Main, Login, Register, Host, Join, GameSession, Settings
    ├── package.json
    └── package-lock.json
```

## 🔧 Prerequisites

- **Python 3.8+** (3.10+ recommended)
- **Node.js 14+** and **npm**
- **Redis** (optional): required only for production-like WebSocket scaling; dev uses in-memory channel layer

## 📦 Installation

### Backend

1. **Go to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   ```
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

### Frontend

1. **Go to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## ⚙️ Configuration

### Backend

Optional `.env` in `backend/`:

```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000

# DB (default: SQLite)
# DB_ENGINE=django.db.backends.sqlite3
# DB_NAME=db.sqlite3

# Channel layer: "memory" (default) or "redis"
CHANNEL_LAYER_BACKEND=memory

# Redis (only if CHANNEL_LAYER_BACKEND=redis)
# REDIS_HOST=localhost
# REDIS_PORT=6379

# JWT (optional)
# JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
# JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

### Frontend

- **API base URL**: `REACT_APP_API_URL` (default: `http://localhost:8000/api`)
- **WebSocket base URL**: `REACT_APP_WS_URL` (default: `ws://localhost:8000`)

Set in `.env` in `frontend/` or in your shell before `npm start`.

## 🚀 Running the Application

Use **Daphne (ASGI)** for the backend so WebSockets work. The plain Django `runserver` does not run the ASGI app.

### Backend (Daphne)

**Windows:**
```bash
cd backend
venv\Scripts\activate
run_asgi_server.bat
```

**Linux/Mac:**
```bash
cd backend
source venv/bin/activate
./run_asgi_server.sh
```

Or manually:
```bash
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

Backend: `http://localhost:8000`

### Frontend

```bash
cd frontend
npm start
```

Frontend: `http://localhost:3000`

---

Run backend and frontend in **separate terminals**.

## 🐳 Running with Docker

A single **Dockerfile** builds the React frontend, serves it from Django, and runs Daphne (ASGI) so you can run everything with one container.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed.

### Build and run

From the project root (`letter-game/`):

```bash
docker build -t letter-game .
docker run -p 8000:8000 letter-game
```

Then open **http://localhost:8000** in your browser. The app (frontend + API + WebSockets) is served on port 8000.

### Options

- **Custom port** (e.g. 9000):
  ```bash
  docker run -p 9000:8000 letter-game
  ```
  Use **http://localhost:9000**. WebSockets are built for port 8000; if you map to another port, rebuild with matching `REACT_APP_WS_URL` (e.g. `ws://localhost:9000`) so real-time updates work.

- **Environment variables** (e.g. `SECRET_KEY`, `DEBUG`):
  ```bash
  docker run -p 8000:8000 -e SECRET_KEY=your-secret -e DEBUG=False letter-game
  ```

- **Persistent database** (volume for SQLite):
  ```bash
  docker run -p 8000:8000 -v letter-game-db:/app/backend/data -e DB_NAME=data/db.sqlite3 letter-game
  ```
  The `data` directory is created automatically; the DB file persists across container restarts.

### Notes

- The image uses an **in-memory** channel layer (no Redis). WebSockets work for a single process.
- The frontend is built with `REACT_APP_API_URL=/api` and `REACT_APP_WS_URL=ws://localhost:8000` for same-origin use when you access the app at `http://localhost:8000` (or your host/port). If you use a different host or port, rebuild with the matching `REACT_APP_*` build args or use a reverse proxy that preserves the same origin.

## 📝 Getting Started

1. **Register** at `/register`, then **log in** at `/login`.
2. **Host a game**: `/host` → create room → configure rules (letter, categories, rounds, timer) at `/host/rules/:roomId` → start game.
3. **Join a game**: `/join` → enter room ID → wait for host to start.
4. **Play**: Each round shows a letter. Submit one answer per category starting with that letter before the timer ends. View results and proceed to the next round.

## 📚 Dependencies

### Backend (main)

| Package | Purpose |
|--------|---------|
| Django | Web framework |
| djangorestframework | REST API |
| djangorestframework-simplejwt | JWT auth |
| django-cors-headers | CORS |
| channels | WebSockets |
| channels-redis | Redis channel layer (optional) |
| daphne | ASGI server |
| redis | Redis client (for channels-redis) |

See `backend/requirements.txt` for versions.

### Frontend (main)

| Package | Purpose |
|--------|---------|
| react, react-dom | UI |
| react-router-dom | Routing |
| axios | HTTP client |
| @tanstack/react-query | Data fetching / cache |

See `frontend/package.json` for versions.

## 🔌 API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register/` | Register |
| POST | `/api/login/` | Login (returns JWT + user) |
| POST | `/api/token/refresh/` | Refresh access token |
| GET | `/api/me/` | Current user (auth required) |

### Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms/create/` | Create room |
| POST | `/api/rooms/join/` | Join room |
| GET | `/api/rooms/<uuid>/` | Room detail |
| POST | `/api/rooms/<uuid>/leave/` | Leave room |
| POST | `/api/rooms/<uuid>/delete/` | Delete room (host) |
| POST | `/api/rooms/<uuid>/players/<id>/delete/` | Remove player (host) |

### Game session

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/game-types/` | List category types |
| GET | `/api/rooms/<uuid>/game-session/` | Get game session |
| PUT | `/api/rooms/<uuid>/game-session/update/` | Update rules |
| POST | `/api/rooms/<uuid>/game-session/start/` | Start game |
| POST | `/api/rooms/<uuid>/game-session/submit/` | Submit answers |
| GET | `/api/rooms/<uuid>/game-session/scores/` | Player scores |
| POST | `/api/rooms/<uuid>/game-session/advance-round/` | Advance round |
| POST | `/api/rooms/<uuid>/game-session/end/` | End game |

## 🔌 WebSockets

- **URL**: `ws://localhost:8000/ws/room/<room_id>/?token=<access_token>`
- **Auth**: JWT `access_token` in query string.
- **Events** (server → client): `room_update`, `game_started_notification`, `player_submitted_notification`, `player_removed_notification`, `room_deleted_notification`.
- **Events** (client → server): `player_joined`, `player_left`, `player_removed`.

Used for real-time room state, game start, and submissions.

## 🐛 Troubleshooting

### Backend

- **Import / module errors**: Activate venv and `pip install -r requirements.txt`.
- **Migration errors**: Run `python manage.py migrate` from `backend/`.
- **Port 8000 in use**: Set `PORT=8001` (or use `-p 8001` with `daphne`) and point frontend `REACT_APP_API_URL` / `REACT_APP_WS_URL` to the new host/port.

### Frontend

- **`npm install` fails**: Try `npm cache clean --force`, delete `node_modules` and `package-lock.json`, then `npm install` again.
- **CORS errors**: Ensure backend `CORS_ALLOWED_ORIGINS` includes the frontend origin (e.g. `http://localhost:3000`) and the backend is running.
- **Can’t reach API**: Check `REACT_APP_API_URL` and that the backend is up. Use `http://localhost:8000` (or your `daphne` port).
- **WebSocket not connecting**: Check `REACT_APP_WS_URL`, use `ws://` (not `wss://`) for localhost, and ensure you’re using Daphne (not `runserver`).

### Redis (optional)

- **Channel layer**: For multi-process production, set `CHANNEL_LAYER_BACKEND=redis` and configure `REDIS_HOST` / `REDIS_PORT`. Dev default is `memory`.

### Docker

- **Build fails (frontend stage)**: Ensure `frontend/package.json` and `frontend/package-lock.json` exist and `npm run build` works locally.
- **Build fails (backend stage)**: Run `pip install -r backend/requirements.txt` and `python manage.py migrate` locally to verify.
- **404 on `/` or SPA routes**: The image serves the React build from Django. Rebuild the image after frontend changes.

### General

- **Both servers**: Run backend and frontend in separate terminals.
- **Changes not showing**: Restart the dev server (frontend or Daphne) if needed.

## 📄 License

This project is open source and available for educational use.

## 👥 Contributing

Contributions are welcome. Please open an issue or pull request.

## 📧 Support

For bugs or questions, open an issue in the project repository.

---

**Have fun playing! 🎮**
