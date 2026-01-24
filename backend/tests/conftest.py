"""
Pytest configuration file for Django tests.
"""
import pytest
import os

# Set Django settings module for pytest-django
# This must be set before importing Django modules
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')


@pytest.fixture
def api_client():
    """Fixture for API client."""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def user_data():
    """Fixture providing valid user registration data."""
    return {
        'username': 'testuser',
        'email': 'testuser@example.com',
        'password': 'testpass123',
        'game_name': 'TestPlayer'
    }


@pytest.fixture
def existing_user(db):
    """Fixture creating an existing user in the database."""
    from django.contrib.auth.models import User
    return User.objects.create_user(
        username='existinguser',
        email='existing@example.com',
        password='existingpass123'
    )
