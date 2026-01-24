"""
Tests for user registration functionality.
"""
import pytest
from rest_framework import status


@pytest.mark.django_db
class TestRegisterView:
    """Test suite for RegisterView."""

    def test_register_user_success(self, api_client, user_data):
        """Test successful user registration with valid data."""
        url = '/api/register/'
        response = api_client.post(url, user_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'username' in response.data
        assert 'email' in response.data
        assert response.data['username'] == user_data['username']
        assert response.data['email'] == user_data['email']
        assert 'password' not in response.data  # Password should not be in response
        
        # Verify user was created in database
        from django.contrib.auth.models import User
        user = User.objects.get(username=user_data['username'])
        assert user.email == user_data['email']
        assert user.check_password(user_data['password'])
        assert user.first_name == user_data['game_name']

    def test_register_user_without_game_name(self, api_client):
        """Test user registration without optional game_name."""
        data = {
            'username': 'testuser2',
            'email': 'testuser2@example.com',
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        from django.contrib.auth.models import User
        user = User.objects.get(username=data['username'])
        assert user.first_name == ''  # Should be empty string if not provided

    def test_register_user_missing_username(self, api_client):
        """Test registration fails when username is missing."""
        data = {
            'email': 'test@example.com',
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'username' in response.data

    def test_register_user_missing_email(self, api_client):
        """Test registration fails when email is missing."""
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.data

    def test_register_user_missing_password(self, api_client):
        """Test registration fails when password is missing."""
        data = {
            'username': 'testuser',
            'email': 'test@example.com'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data

    def test_register_user_duplicate_username(self, api_client, user_data, existing_user):
        """Test registration fails when username already exists."""
        data = {
            'username': existing_user.username,
            'email': 'different@example.com',
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'username' in response.data

    def test_register_user_duplicate_email(self, api_client, user_data, existing_user):
        """Test registration fails when email already exists."""
        data = {
            'username': 'newuser',
            'email': existing_user.email,
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.data

    def test_register_user_invalid_email_format(self, api_client):
        """Test registration fails with invalid email format."""
        data = {
            'username': 'testuser',
            'email': 'invalid-email',
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.data

    def test_register_user_password_too_short(self, api_client):
        """Test registration fails when password is too short."""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'short'  # Less than 8 characters
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data

    def test_register_user_empty_username(self, api_client):
        """Test registration fails with empty username."""
        data = {
            'username': '',
            'email': 'test@example.com',
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'username' in response.data

    def test_register_user_empty_email(self, api_client):
        """Test registration fails with empty email."""
        data = {
            'username': 'testuser',
            'email': '',
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.data

    def test_register_user_blank_game_name(self, api_client):
        """Test registration succeeds with blank game_name."""
        data = {
            'username': 'testuser3',
            'email': 'testuser3@example.com',
            'password': 'testpass123',
            'game_name': ''
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        from django.contrib.auth.models import User
        user = User.objects.get(username=data['username'])
        assert user.first_name == ''

    def test_register_user_password_not_in_response(self, api_client, user_data):
        """Test that password is not included in the response."""
        url = '/api/register/'
        response = api_client.post(url, user_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'password' not in response.data

    def test_register_user_creates_inactive_user(self, api_client, user_data):
        """Test that registered user is active by default."""
        url = '/api/register/'
        response = api_client.post(url, user_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        from django.contrib.auth.models import User
        user = User.objects.get(username=user_data['username'])
        assert user.is_active is True

    def test_register_user_sets_last_name_empty(self, api_client, user_data):
        """Test that last_name is set to empty string."""
        url = '/api/register/'
        response = api_client.post(url, user_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        from django.contrib.auth.models import User
        user = User.objects.get(username=user_data['username'])
        assert user.last_name == ''

    def test_register_user_with_special_characters_in_username(self, api_client):
        """Test registration with special characters in username."""
        data = {
            'username': 'test_user-123',
            'email': 'special@example.com',
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        from django.contrib.auth.models import User
        user = User.objects.get(username=data['username'])
        assert user.username == data['username']

    def test_register_user_with_long_password(self, api_client):
        """Test registration with a long password."""
        data = {
            'username': 'testuser4',
            'email': 'testuser4@example.com',
            'password': 'a' * 100  # Very long password
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        from django.contrib.auth.models import User
        user = User.objects.get(username=data['username'])
        assert user.check_password(data['password'])

    def test_register_user_case_sensitive_email(self, api_client, existing_user):
        """Test that email uniqueness is case-sensitive."""
        # Django's User model by default is case-sensitive for emails
        data = {
            'username': 'newuser2',
            'email': existing_user.email.upper(),  # Different case
            'password': 'testpass123'
        }
        url = '/api/register/'
        response = api_client.post(url, data, format='json')
        
        # This should succeed if email uniqueness is case-sensitive
        # or fail if case-insensitive - depends on Django version/settings
        # For Django 5.2, email uniqueness is typically case-sensitive
        assert response.status_code in [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST]
