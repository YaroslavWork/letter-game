# Authentication System

A full-stack web application featuring user registration and authentication with JWT tokens. Built with Django REST Framework backend and React frontend.

## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Step-by-Step Guide: Register & Login](#step-by-step-guide-register--login)
- [Dependencies](#dependencies)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **User Registration**: Create new accounts with username, email, and password
- **User Login**: Secure authentication with JWT tokens
- **Token Management**: Automatic token refresh and storage
- **Protected Routes**: Access user profile information
- **Form Validation**: Client-side and server-side validation
- **Error Handling**: Comprehensive error messages for better UX

## 📁 Project Structure

```
letter_game/
├── backend/                    # Django REST Framework API
│   ├── api/                    # Main API application
│   │   ├── models/            # Database models
│   │   ├── serializers/       # Data serializers
│   │   │   ├── jwt_serializer.py
│   │   │   ├── register_serializer.py
│   │   │   └── user_serializer.py
│   │   ├── views/             # API views
│   │   │   ├── login_view.py
│   │   │   ├── register_view.py
│   │   │   └── me_view.py
│   │   ├── urls.py            # API URL routing
│   │   └── models.py
│   ├── backend/                # Django project settings
│   │   ├── settings.py        # Project configuration
│   │   ├── urls.py            # Root URL configuration
│   │   └── wsgi.py
│   ├── db.sqlite3             # SQLite database
│   ├── manage.py              # Django management script
│   ├── requirements.txt       # Python dependencies
│   └── venv/                  # Python virtual environment
│
└── frontend/                   # React frontend application
    ├── public/                 # Static files
    ├── src/
    │   ├── components/        # Reusable UI components
    │   │   └── UI/
    │   │       ├── Button/
    │   │       ├── Header/
    │   │       ├── Input/
    │   │       └── Text/
    │   ├── contexts/           # React contexts
    │   │   └── AuthContext.jsx
    │   ├── features/           # Feature modules
    │   │   ├── api/           # API functions
    │   │   └── hooks/         # Custom React hooks
    │   ├── lib/                # Utility libraries
    │   │   └── axios.js       # Axios configuration
    │   ├── pages/              # Page components
    │   │   ├── LoginPage/
    │   │   ├── RegisterPage/
    │   │   ├── MainPage/
    │   │   └── NotFoundPage/
    │   ├── App.js              # Main app component
    │   └── index.js           # Entry point
    ├── package.json            # Node.js dependencies
    └── package-lock.json
```

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8+** (Python 3.13.7 recommended)
- **Node.js 14+** and **npm** (or **yarn**)
- **Git** (for cloning the repository)

## 📦 Installation

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (if not already created):**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment:**
   - On Linux/Mac:
     ```bash
     source venv/bin/activate
     ```
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```

4. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run database migrations:**
   ```bash
   python manage.py migrate
   ```

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

## ⚙️ Configuration

### Backend Configuration

The backend uses environment variables with sensible defaults. You can optionally create a `.env` file in the `backend/` directory:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

**Note:** If no `.env` file exists, the application will use default values suitable for development.

### Frontend Configuration

The frontend is configured to connect to `http://localhost:8000/api` by default. This is set in `frontend/src/lib/axios.js`.

## 🚀 Running the Application

### Start the Backend Server

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Activate the virtual environment:**
   ```bash
   source venv/bin/activate  # Linux/Mac
   # or
   venv\Scripts\activate      # Windows
   ```

3. **Start the Django development server:**
   ```bash
   python manage.py runserver
   ```

   The backend will be available at: `http://localhost:8000`

### Start the Frontend Server

1. **Open a new terminal and navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Start the React development server:**
   ```bash
   npm start
   ```

   The frontend will be available at: `http://localhost:3000`

   The browser should automatically open. If not, navigate to `http://localhost:3000` manually.

## 📝 Step-by-Step Guide: Register & Login

### Registration Process

1. **Navigate to the Register Page:**
   - Open your browser and go to `http://localhost:3000`
   - Click the "Register" button, or
   - Navigate directly to `http://localhost:3000/register`

2. **Fill in the Registration Form:**
   - **Username**: Enter a unique username (required)
   - **First Name**: Enter your first name (required)
   - **Last Name**: Enter your last name (optional)
   - **Email**: Enter a valid email address (required, must be unique)
   - **Password**: Enter a password (required, minimum 8 characters)
   - **Repeat Password**: Re-enter your password to confirm (required, must match)

3. **Submit the Form:**
   - Click the "Register" button
   - The form will validate your input:
     - All required fields must be filled
     - Password must be at least 8 characters
     - Passwords must match
     - Email must be valid and unique

4. **Success:**
   - Upon successful registration, you'll see an alert: "Registration successful! Please log in."
   - You'll be automatically redirected to the login page

5. **Error Handling:**
   - If validation fails, error messages will appear below the relevant fields
   - If the username or email already exists, an error message will be displayed
   - Review the errors and correct your input

### Login Process

1. **Navigate to the Login Page:**
   - From the main page, click the "Login" button, or
   - Navigate directly to `http://localhost:3000/login`
   - If you just registered, you'll be redirected here automatically

2. **Enter Your Credentials:**
   - **Username or Email**: Enter the username or email you used during registration
   - **Password**: Enter your password

3. **Submit the Form:**
   - Click the "Login" button
   - The form validates that both fields are filled

4. **Success:**
   - Upon successful login:
     - Your authentication tokens are stored in localStorage
     - You'll be redirected to the main page (`/`)
     - Your user data is fetched and stored in the AuthContext

5. **Error Handling:**
   - If credentials are incorrect, you'll see: "Invalid username or password"
   - If fields are empty, validation errors will appear
   - Review the errors and try again

### Accessing Protected Resources

After logging in, you can access protected endpoints. The application automatically:
- Includes your access token in API requests
- Refreshes your token when it expires
- Redirects you to login if authentication fails

## 📚 Dependencies

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Django | 5.2.7 | Web framework |
| djangorestframework | 3.16.1 | REST API framework |
| djangorestframework-simplejwt | 5.5.1 | JWT authentication |
| django-cors-headers | 4.9.0 | CORS handling |
| PyJWT | 2.10.1 | JWT token handling |
| python-environ | 0.4.54 | Environment variable management |
| sqlparse | 0.5.3 | SQL parsing |
| asgiref | 3.10.0 | ASGI support |

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.0 | UI library |
| react-dom | 19.2.0 | React DOM renderer |
| react-router-dom | 7.9.5 | Client-side routing |
| axios | 1.13.2 | HTTP client |
| @tanstack/react-query | 5.90.7 | Data fetching and caching |
| react-scripts | 5.0.1 | Create React App scripts |

## 🔌 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/register/` | Get registration page info | No |
| POST | `/api/register/` | Register a new user | No |
| POST | `/api/login/` | Login and get JWT tokens | No |
| POST | `/api/token/refresh/` | Refresh access token | No |
| GET | `/api/me/` | Get current user data | Yes |

### Request/Response Examples

#### Register User
```bash
POST /api/register/
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepass123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201 Created):**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe"
}
```

#### Login
```bash
POST /api/login/
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securepass123"
}
```

**Response (200 OK):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

#### Get Current User
```bash
GET /api/me/
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe"
}
```

## 🐛 Troubleshooting

### Backend Issues

**Problem:** `ModuleNotFoundError` or import errors
- **Solution:** Ensure the virtual environment is activated and dependencies are installed:
  ```bash
  source venv/bin/activate
  pip install -r requirements.txt
  ```

**Problem:** Database migration errors
- **Solution:** Run migrations:
  ```bash
  python manage.py migrate
  ```

**Problem:** Port 8000 already in use
- **Solution:** Use a different port:
  ```bash
  python manage.py runserver 8001
  ```
  Then update the frontend axios baseURL accordingly.

### Frontend Issues

**Problem:** `npm install` fails
- **Solution:** Clear cache and reinstall:
  ```bash
  npm cache clean --force
  rm -rf node_modules package-lock.json
  npm install
  ```

**Problem:** CORS errors in browser console
- **Solution:** Ensure the backend CORS settings include `http://localhost:3000` and the backend server is running.

**Problem:** Cannot connect to backend API
- **Solution:** 
  1. Verify the backend server is running on `http://localhost:8000`
  2. Check the axios baseURL in `frontend/src/lib/axios.js`
  3. Check browser console for specific error messages

**Problem:** Tokens not persisting after page refresh
- **Solution:** Check browser localStorage. Tokens should be stored as `access_token` and `refresh_token`.

### General Issues

**Problem:** Both servers won't start simultaneously
- **Solution:** Run them in separate terminal windows/tabs

**Problem:** Changes not reflecting
- **Solution:** 
  - Frontend: The React dev server should auto-reload. If not, restart it.
  - Backend: Django auto-reloads on code changes. Restart if needed.

## 📄 License

This project is open source and available for educational purposes.

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue in the project repository.

---

**Happy Coding! 🚀**
