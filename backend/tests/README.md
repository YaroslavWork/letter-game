# Backend Tests

This directory contains pytest tests for the Django backend.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running Tests

Run all tests:
```bash
pytest
```

Run tests with verbose output:
```bash
pytest -v
```

Run a specific test file:
```bash
pytest tests/test_register.py
```

Run a specific test:
```bash
pytest tests/test_register.py::TestRegisterView::test_register_user_success
```

Run tests with coverage:
```bash
pytest --cov=api --cov-report=html
```

## Test Structure

- `conftest.py`: Pytest configuration and shared fixtures
- `test_register.py`: Tests for user registration functionality

## Writing New Tests

When writing new tests:
1. Use `@pytest.mark.django_db` decorator for tests that need database access
2. Use fixtures from `conftest.py` for common test data
3. Follow the naming convention: `test_*.py` for test files and `test_*` for test functions
