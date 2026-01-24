"""
Tests for Me endpoint functionality.
"""
import pytest
from rest_framework import status


@pytest.mark.django_db
class TestMeView:
    """Test suite for MeView (current user endpoint)."""

    def test_me_endpoint_success(self, api_client):
        """Test successful access to /me endpoint with valid token."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name='TestPlayer'
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
        
        # Access /me endpoint with token
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == user.id
        assert response.data['username'] == user.username
        assert response.data['email'] == user.email
        assert response.data['game_name'] == user.first_name

    def test_me_endpoint_unauthenticated(self, api_client):
        """Test /me endpoint without authentication returns 401."""
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_endpoint_invalid_token(self, api_client):
        """Test /me endpoint with invalid token returns 401."""
        api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_12345')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_endpoint_expired_token(self, api_client):
        """Test /me endpoint with expired token returns 401."""
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import AccessToken
        from django.utils import timezone
        from datetime import timedelta
        User = get_user_model()
        
        # Create user
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        # Create an expired token manually
        token = AccessToken.for_user(user)
        # Manually set expiration to past
        token.set_exp(from_time=timezone.now() - timedelta(hours=1))
        expired_token = str(token)
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {expired_token}')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_endpoint_missing_bearer_prefix(self, api_client):
        """Test /me endpoint without Bearer prefix returns 401."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user and login
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Try without Bearer prefix
        api_client.credentials(HTTP_AUTHORIZATION=access_token)
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_endpoint_response_structure(self, api_client):
        """Test that /me endpoint returns correct data structure."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name='GamePlayer'
        )
        
        # Login to get token
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Access /me endpoint
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, dict)
        
        # Check all required fields are present
        assert 'id' in response.data
        assert 'username' in response.data
        assert 'email' in response.data
        assert 'game_name' in response.data
        
        # Check password is not in response
        assert 'password' not in response.data
        assert 'last_name' not in response.data

    def test_me_endpoint_user_without_game_name(self, api_client):
        """Test /me endpoint for user without game_name."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user without first_name
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name=''  # Empty game name
        )
        
        # Login to get token
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Access /me endpoint
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['game_name'] == ''
        assert response.data['username'] == 'testuser'

    def test_me_endpoint_different_users(self, api_client):
        """Test that /me endpoint returns data for the authenticated user only."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create two users
        user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='pass123',
            first_name='Player1'
        )
        
        user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='pass123',
            first_name='Player2'
        )
        
        # Login as user1
        login_url = '/api/login/'
        login_data1 = {
            'username': 'user1',
            'password': 'pass123'
        }
        login_response1 = api_client.post(login_url, login_data1, format='json')
        access_token1 = login_response1.data['access']
        
        # Access /me endpoint as user1
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token1}')
        me_url = '/api/me/'
        response1 = api_client.get(me_url)
        
        assert response1.status_code == status.HTTP_200_OK
        assert response1.data['username'] == 'user1'
        assert response1.data['id'] == user1.id
        
        # Login as user2
        login_data2 = {
            'username': 'user2',
            'password': 'pass123'
        }
        login_response2 = api_client.post(login_url, login_data2, format='json')
        access_token2 = login_response2.data['access']
        
        # Access /me endpoint as user2
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token2}')
        response2 = api_client.get(me_url)
        
        assert response2.status_code == status.HTTP_200_OK
        assert response2.data['username'] == 'user2'
        assert response2.data['id'] == user2.id
        assert response2.data['id'] != user1.id

    def test_me_endpoint_refreshed_token(self, api_client):
        """Test that refreshed access token works with /me endpoint."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        # Login to get tokens
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        refresh_token = login_response.data['refresh']
        
        # Refresh the token
        refresh_url = '/api/token/refresh/'
        refresh_data = {'refresh': refresh_token}
        refresh_response = api_client.post(refresh_url, refresh_data, format='json')
        new_access_token = refresh_response.data['access']
        
        # Use refreshed token to access /me endpoint
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access_token}')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == user.username

    def test_me_endpoint_only_get_method(self, api_client):
        """Test that /me endpoint only accepts GET requests."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user and login
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = '/api/me/'
        
        # GET should work
        get_response = api_client.get(me_url)
        assert get_response.status_code == status.HTTP_200_OK
        
        # POST should not work
        post_response = api_client.post(me_url, {}, format='json')
        assert post_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # PUT should not work
        put_response = api_client.put(me_url, {}, format='json')
        assert put_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # DELETE should not work
        delete_response = api_client.delete(me_url)
        assert delete_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_me_endpoint_inactive_user(self, api_client):
        """Test /me endpoint with inactive user token."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user
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
        access_token = login_response.data['access']
        
        # Deactivate user
        user.is_active = False
        user.save()
        
        # Try to access /me endpoint
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        # Should fail because user is inactive
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_endpoint_data_types(self, api_client):
        """Test that /me endpoint returns correct data types."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name='TestPlayer'
        )
        
        # Login to get token
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Access /me endpoint
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Check data types
        assert isinstance(response.data['id'], int)
        assert isinstance(response.data['username'], str)
        assert isinstance(response.data['email'], str)
        assert isinstance(response.data['game_name'], str)

    def test_me_endpoint_special_characters_in_username(self, api_client):
        """Test /me endpoint with special characters in username."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user with special characters
        user = User.objects.create_user(
            username='test_user-123',
            email='special@example.com',
            password='testpass123'
        )
        
        # Login to get token
        login_url = '/api/login/'
        login_data = {
            'username': 'test_user-123',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Access /me endpoint
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_url = '/api/me/'
        response = api_client.get(me_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == 'test_user-123'
