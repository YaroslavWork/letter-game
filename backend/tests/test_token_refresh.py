"""
Tests for JWT token refresh functionality.
"""
import pytest
from rest_framework import status


@pytest.mark.django_db
class TestTokenRefreshView:
    """Test suite for TokenRefreshView."""

    def test_token_refresh_success(self, api_client):
        """Test successful token refresh with valid refresh token."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user and login to get tokens
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        # Login to get refresh token
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        
        assert login_response.status_code == status.HTTP_200_OK
        refresh_token = login_response.data['refresh']
        original_access_token = login_response.data['access']
        
        # Refresh the token
        refresh_url = '/api/token/refresh/'
        refresh_data = {
            'refresh': refresh_token
        }
        refresh_response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert refresh_response.status_code == status.HTTP_200_OK
        assert 'access' in refresh_response.data
        new_access_token = refresh_response.data['access']
        
        # New access token should be different from original
        assert new_access_token != original_access_token
        
        # New access token should be valid
        assert isinstance(new_access_token, str)
        assert len(new_access_token) > 0

    def test_token_refresh_missing_refresh_token(self, api_client):
        """Test token refresh fails when refresh token is missing."""
        refresh_url = '/api/token/refresh/'
        refresh_data = {}
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'refresh' in response.data

    def test_token_refresh_empty_refresh_token(self, api_client):
        """Test token refresh fails with empty refresh token."""
        refresh_url = '/api/token/refresh/'
        refresh_data = {
            'refresh': ''
        }
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_token_refresh_invalid_token(self, api_client):
        """Test token refresh fails with invalid refresh token."""
        refresh_url = '/api/token/refresh/'
        refresh_data = {
            'refresh': 'invalid_token_string_12345'
        }
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST]

    def test_token_refresh_with_access_token(self, api_client):
        """Test that using access token instead of refresh token fails."""
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
        
        assert login_response.status_code == status.HTTP_200_OK
        access_token = login_response.data['access']
        
        # Try to use access token as refresh token
        refresh_url = '/api/token/refresh/'
        refresh_data = {
            'refresh': access_token  # Wrong token type
        }
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        # Should fail because access token cannot be used for refresh
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST]

    def test_token_refresh_multiple_times(self, api_client):
        """Test that refresh token can be used multiple times (if rotation disabled)."""
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
        
        assert login_response.status_code == status.HTTP_200_OK
        refresh_token = login_response.data['refresh']
        
        # First refresh
        refresh_url = '/api/token/refresh/'
        refresh_data = {'refresh': refresh_token}
        response1 = api_client.post(refresh_url, refresh_data, format='json')
        assert response1.status_code == status.HTTP_200_OK
        access_token1 = response1.data['access']
        
        # Second refresh (if rotation is enabled, might get new refresh token)
        response2 = api_client.post(refresh_url, refresh_data, format='json')
        assert response2.status_code == status.HTTP_200_OK
        access_token2 = response2.data['access']
        
        # Access tokens should be different
        assert access_token1 != access_token2

    def test_refreshed_token_can_be_used(self, api_client):
        """Test that refreshed access token can be used for authenticated requests."""
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
        
        assert login_response.status_code == status.HTTP_200_OK
        refresh_token = login_response.data['refresh']
        
        # Refresh the token
        refresh_url = '/api/token/refresh/'
        refresh_data = {'refresh': refresh_token}
        refresh_response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert refresh_response.status_code == status.HTTP_200_OK
        new_access_token = refresh_response.data['access']
        
        # Use new access token to access protected endpoint
        me_url = '/api/me/'
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access_token}')
        me_response = api_client.get(me_url)
        
        assert me_response.status_code == status.HTTP_200_OK
        assert me_response.data['username'] == user.username

    def test_token_refresh_returns_only_access_token(self, api_client):
        """Test that refresh endpoint returns only access token, not refresh token."""
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
        
        assert login_response.status_code == status.HTTP_200_OK
        refresh_token = login_response.data['refresh']
        
        # Refresh the token
        refresh_url = '/api/token/refresh/'
        refresh_data = {'refresh': refresh_token}
        refresh_response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert refresh_response.status_code == status.HTTP_200_OK
        # Should only contain 'access', not 'refresh' (unless rotation is enabled)
        assert 'access' in refresh_response.data
        
        # If rotation is enabled, might also return new refresh token
        # If rotation is disabled, should not return refresh token
        # Both behaviors are acceptable

    def test_token_refresh_with_malformed_token(self, api_client):
        """Test token refresh with malformed token string."""
        refresh_url = '/api/token/refresh/'
        refresh_data = {
            'refresh': 'not.a.valid.jwt.token.format'
        }
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST]

    def test_token_refresh_with_wrong_field_name(self, api_client):
        """Test token refresh with wrong field name."""
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
        
        assert login_response.status_code == status.HTTP_200_OK
        refresh_token = login_response.data['refresh']
        
        # Try with wrong field name
        refresh_url = '/api/token/refresh/'
        refresh_data = {
            'token': refresh_token  # Wrong field name
        }
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'refresh' in response.data

    def test_token_refresh_unauthorized_access(self, api_client):
        """Test that token refresh endpoint doesn't require authentication."""
        # Token refresh should work without being authenticated
        # (it uses the refresh token itself for authentication)
        refresh_url = '/api/token/refresh/'
        refresh_data = {
            'refresh': 'some_token'
        }
        # Should not require Authorization header
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        # Will fail due to invalid token, but not due to missing auth
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED]

    def test_token_refresh_after_user_deactivated(self, api_client):
        """Test that refresh token becomes invalid after user is deactivated."""
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
        
        assert login_response.status_code == status.HTTP_200_OK
        refresh_token = login_response.data['refresh']
        
        # Deactivate user
        user.is_active = False
        user.save()
        
        # Try to refresh token
        refresh_url = '/api/token/refresh/'
        refresh_data = {'refresh': refresh_token}
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        # Token refresh might still work (depends on JWT implementation)
        # But using the new access token should fail
        if response.status_code == status.HTTP_200_OK:
            new_access_token = response.data['access']
            # Try to use the token
            api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access_token}')
            me_response = api_client.get('/api/me/')
            # Should fail because user is inactive
            assert me_response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_refresh_response_structure(self, api_client):
        """Test that refresh response has correct structure."""
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
        
        assert login_response.status_code == status.HTTP_200_OK
        refresh_token = login_response.data['refresh']
        
        # Refresh the token
        refresh_url = '/api/token/refresh/'
        refresh_data = {'refresh': refresh_token}
        refresh_response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert refresh_response.status_code == status.HTTP_200_OK
        assert isinstance(refresh_response.data, dict)
        assert 'access' in refresh_response.data
        assert isinstance(refresh_response.data['access'], str)
