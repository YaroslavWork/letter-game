"""
Tests for user login functionality.
"""
import pytest
from rest_framework import status


@pytest.mark.django_db
class TestLoginView:
    """Test suite for CustomTokenObtainPairView (login)."""

    def test_login_success_with_username(self, api_client):
        """Test successful login with username."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        # Create a test user
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name='TestPlayer'
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert 'user' in response.data
        
        # Check user data in response
        user_data = response.data['user']
        assert user_data['id'] == user.id
        assert user_data['username'] == user.username
        assert user_data['email'] == user.email
        assert user_data['game_name'] == user.first_name

    def test_login_success_with_email(self, api_client):
        """Test successful login with email instead of username."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(
            username='testuser2',
            email='testuser2@example.com',
            password='testpass123',
            first_name='TestPlayer2'
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser2@example.com',  # Using email as username
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert 'user' in response.data
        assert response.data['user']['username'] == user.username

    def test_login_missing_username(self, api_client):
        """Test login fails when username is missing."""
        url = '/api/login/'
        data = {
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'username' in response.data or 'non_field_errors' in response.data

    def test_login_missing_password(self, api_client):
        """Test login fails when password is missing."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data or 'non_field_errors' in response.data

    def test_login_invalid_username(self, api_client):
        """Test login fails with non-existent username."""
        url = '/api/login/'
        data = {
            'username': 'nonexistent',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        # ValidationError from serializer typically returns 400
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED]
        # Check for error message about credentials
        assert 'detail' in response.data or 'non_field_errors' in response.data or len(response.data) > 0

    def test_login_invalid_email(self, api_client):
        """Test login fails with non-existent email."""
        url = '/api/login/'
        data = {
            'username': 'nonexistent@example.com',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        # ValidationError from serializer typically returns 400
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED]
        # Check for error message about credentials
        assert 'detail' in response.data or 'non_field_errors' in response.data or len(response.data) > 0

    def test_login_wrong_password(self, api_client):
        """Test login fails with incorrect password."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='correctpass123'
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser',
            'password': 'wrongpassword'
        }
        response = api_client.post(url, data, format='json')
        
        # ValidationError from serializer typically returns 400
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED]
        # Check for error message about credentials
        assert 'detail' in response.data or 'non_field_errors' in response.data or len(response.data) > 0

    def test_login_inactive_user(self, api_client):
        """Test login fails for inactive user."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(
            username='inactiveuser',
            email='inactive@example.com',
            password='testpass123'
        )
        user.is_active = False
        user.save()
        
        url = '/api/login/'
        data = {
            'username': 'inactiveuser',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        # ValidationError from serializer typically returns 400
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED]
        # Check for error message about disabled account
        assert 'detail' in response.data or 'non_field_errors' in response.data or len(response.data) > 0

    def test_login_empty_username(self, api_client):
        """Test login fails with empty username."""
        url = '/api/login/'
        data = {
            'username': '',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_empty_password(self, api_client):
        """Test login fails with empty password."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser',
            'password': ''
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_response_contains_tokens(self, api_client):
        """Test that login response contains both access and refresh tokens."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        access_token = response.data['access']
        refresh_token = response.data['refresh']
        
        # Tokens should be strings and not empty
        assert isinstance(access_token, str)
        assert isinstance(refresh_token, str)
        assert len(access_token) > 0
        assert len(refresh_token) > 0

    def test_login_user_data_structure(self, api_client):
        """Test that user data in response has correct structure."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name='GamePlayer'
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        user_data = response.data['user']
        
        # Check all required fields are present
        assert 'id' in user_data
        assert 'username' in user_data
        assert 'email' in user_data
        assert 'game_name' in user_data
        
        # Check values match
        assert user_data['id'] == user.id
        assert user_data['username'] == 'testuser'
        assert user_data['email'] == 'testuser@example.com'
        assert user_data['game_name'] == 'GamePlayer'

    def test_login_user_without_game_name(self, api_client):
        """Test login for user without game_name (first_name)."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name=''  # Empty game name
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['user']['game_name'] == ''

    def test_login_case_sensitive_username(self, api_client):
        """Test that username login is case-sensitive."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.create_user(
            username='TestUser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        url = '/api/login/'
        # Try with different case
        data = {
            'username': 'testuser',  # lowercase
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        # Django usernames are case-sensitive, so this should fail
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED]

    def test_login_with_special_characters_in_username(self, api_client):
        """Test login with special characters in username."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(
            username='test_user-123',
            email='special@example.com',
            password='testpass123'
        )
        
        url = '/api/login/'
        data = {
            'username': 'test_user-123',
            'password': 'testpass123'
        }
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['user']['username'] == 'test_user-123'

    def test_login_token_can_be_used_for_authentication(self, api_client):
        """Test that the access token can be used for authenticated requests."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        # Login to get token
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        
        assert login_response.status_code == status.HTTP_200_OK
        access_token = login_response.data['access']
        
        # Use token to access protected endpoint
        me_url = '/api/me/'
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_response = api_client.get(me_url)
        
        assert me_response.status_code == status.HTTP_200_OK
        assert me_response.data['username'] == user.username

    def test_login_multiple_attempts(self, api_client):
        """Test multiple login attempts."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        url = '/api/login/'
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        
        # First login
        response1 = api_client.post(url, data, format='json')
        assert response1.status_code == status.HTTP_200_OK
        
        # Second login (should also succeed)
        response2 = api_client.post(url, data, format='json')
        assert response2.status_code == status.HTTP_200_OK
        
        # Tokens should be different (due to token rotation or different timestamps)
        # At minimum, both should be valid
        assert 'access' in response1.data
        assert 'access' in response2.data
