"""
Tests for Create Room endpoint functionality.
"""
import pytest
from rest_framework import status


@pytest.mark.django_db
class TestCreateRoomView:
    """Test suite for CreateRoomView."""

    def test_create_room_success_with_name(self, api_client):
        """Test successful room creation with custom name."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user and login
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name='TestPlayer'
        )
        
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Create room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {
            'name': 'My Custom Room'
        }
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'My Custom Room'
        assert response.data['host_id'] == user.id
        assert response.data['host_username'] == user.username
        assert response.data['host_game_name'] == user.first_name
        assert response.data['is_active'] is True
        assert 'id' in response.data
        assert 'created_at' in response.data

    def test_create_room_success_without_name(self, api_client):
        """Test successful room creation without name (uses default)."""
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
        
        # Create room without name
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {}
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Letter Game Room'  # Default name
        assert response.data['host_id'] == user.id

    def test_create_room_unauthenticated(self, api_client):
        """Test room creation without authentication returns 401."""
        create_url = '/api/rooms/create/'
        room_data = {
            'name': 'Test Room'
        }
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_room_name_too_long(self, api_client):
        """Test room creation with name exceeding max length."""
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
        
        # Create room with name too long (max 100 characters)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {
            'name': 'a' * 101  # Exceeds max_length=100
        }
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'name' in response.data

    def test_create_room_host_added_as_player(self, api_client):
        """Test that host is automatically added as a player."""
        from django.contrib.auth import get_user_model
        from api.models import RoomPlayer
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
        
        # Create room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {'name': 'Test Room'}
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        room_id = response.data['id']
        
        # Check that host is in players list
        assert response.data['player_count'] == 1
        assert len(response.data['players']) == 1
        assert response.data['players'][0]['user_id'] == user.id
        assert response.data['players'][0]['username'] == user.username
        
        # Verify in database
        from api.models import Room
        room = Room.objects.get(id=room_id)
        assert RoomPlayer.objects.filter(room=room, user=user).exists()

    def test_create_room_game_session_created(self, api_client):
        """Test that a default game session is created with the room."""
        from django.contrib.auth import get_user_model
        from api.models import Room, GameSession
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
        
        # Create room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {'name': 'Test Room'}
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        room_id = response.data['id']
        
        # Check that game session exists
        room = Room.objects.get(id=room_id)
        assert hasattr(room, 'game_session')
        game_session = room.game_session
        assert game_session.is_random_letter is True
        assert game_session.selected_types == []
        assert game_session.current_round == 1
        assert game_session.is_completed is False
        
        # Check game session in response
        assert 'game_session' in response.data
        assert response.data['game_session'] is not None

    def test_create_room_response_structure(self, api_client):
        """Test that room creation response has correct structure."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user and login
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name='TestPlayer'
        )
        
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Create room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {'name': 'Test Room'}
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check all required fields
        assert 'id' in response.data
        assert 'name' in response.data
        assert 'host_id' in response.data
        assert 'host_username' in response.data
        assert 'host_game_name' in response.data
        assert 'created_at' in response.data
        assert 'is_active' in response.data
        assert 'players' in response.data
        assert 'player_count' in response.data
        assert 'game_session' in response.data
        
        # Check data types
        assert isinstance(response.data['id'], str)  # UUID as string
        assert isinstance(response.data['name'], str)
        assert isinstance(response.data['host_id'], int)
        assert isinstance(response.data['host_username'], str)
        assert isinstance(response.data['is_active'], bool)
        assert isinstance(response.data['players'], list)
        assert isinstance(response.data['player_count'], int)

    def test_create_multiple_rooms_same_user(self, api_client):
        """Test that a user can create multiple rooms."""
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
        create_url = '/api/rooms/create/'
        
        # Create first room
        room_data1 = {'name': 'Room 1'}
        response1 = api_client.post(create_url, room_data1, format='json')
        assert response1.status_code == status.HTTP_201_CREATED
        room_id1 = response1.data['id']
        
        # Create second room
        room_data2 = {'name': 'Room 2'}
        response2 = api_client.post(create_url, room_data2, format='json')
        assert response2.status_code == status.HTTP_201_CREATED
        room_id2 = response2.data['id']
        
        # Rooms should be different
        assert room_id1 != room_id2
        assert response1.data['name'] == 'Room 1'
        assert response2.data['name'] == 'Room 2'

    def test_create_room_different_users(self, api_client):
        """Test that different users can create their own rooms."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create first user and login
        user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='pass123'
        )
        
        login_url = '/api/login/'
        login_data1 = {
            'username': 'user1',
            'password': 'pass123'
        }
        login_response1 = api_client.post(login_url, login_data1, format='json')
        access_token1 = login_response1.data['access']
        
        # Create room as user1
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token1}')
        create_url = '/api/rooms/create/'
        room_data1 = {'name': 'User1 Room'}
        response1 = api_client.post(create_url, room_data1, format='json')
        assert response1.status_code == status.HTTP_201_CREATED
        assert response1.data['host_id'] == user1.id
        
        # Create second user and login
        user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='pass123'
        )
        
        login_data2 = {
            'username': 'user2',
            'password': 'pass123'
        }
        login_response2 = api_client.post(login_url, login_data2, format='json')
        access_token2 = login_response2.data['access']
        
        # Create room as user2
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token2}')
        room_data2 = {'name': 'User2 Room'}
        response2 = api_client.post(create_url, room_data2, format='json')
        assert response2.status_code == status.HTTP_201_CREATED
        assert response2.data['host_id'] == user2.id
        assert response2.data['host_id'] != user1.id

    def test_create_room_empty_name(self, api_client):
        """Test room creation with empty name (should use default)."""
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
        
        # Create room with empty name
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {'name': ''}
        response = api_client.post(create_url, room_data, format='json')
        
        # Empty string might be treated as default or might fail validation
        # Check both possibilities
        assert response.status_code in [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST]
        if response.status_code == status.HTTP_201_CREATED:
            # If it succeeds, should use default name
            assert response.data['name'] == 'Letter Game Room'

    def test_create_room_only_post_method(self, api_client):
        """Test that create room endpoint only accepts POST requests."""
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
        create_url = '/api/rooms/create/'
        room_data = {'name': 'Test Room'}
        
        # POST should work
        post_response = api_client.post(create_url, room_data, format='json')
        assert post_response.status_code == status.HTTP_201_CREATED
        
        # GET should not work
        get_response = api_client.get(create_url)
        assert get_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # PUT should not work
        put_response = api_client.put(create_url, room_data, format='json')
        assert put_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # DELETE should not work
        delete_response = api_client.delete(create_url)
        assert delete_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_create_room_with_special_characters_in_name(self, api_client):
        """Test room creation with special characters in name."""
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
        
        # Create room with special characters
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {'name': 'Room #1 - Test & More!'}
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Room #1 - Test & More!'

    def test_create_room_invalid_token(self, api_client):
        """Test room creation with invalid token returns 401."""
        api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_12345')
        create_url = '/api/rooms/create/'
        room_data = {'name': 'Test Room'}
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_room_expired_token(self, api_client):
        """Test room creation with expired token returns 401."""
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
        
        # Create expired token
        token = AccessToken.for_user(user)
        token.set_exp(from_time=timezone.now() - timedelta(hours=1))
        expired_token = str(token)
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {expired_token}')
        create_url = '/api/rooms/create/'
        room_data = {'name': 'Test Room'}
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_room_players_list_structure(self, api_client):
        """Test that players list in response has correct structure."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Create user and login
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            first_name='TestPlayer'
        )
        
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Create room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        create_url = '/api/rooms/create/'
        room_data = {'name': 'Test Room'}
        response = api_client.post(create_url, room_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert isinstance(response.data['players'], list)
        assert len(response.data['players']) == 1
        
        player = response.data['players'][0]
        assert 'id' in player
        assert 'user_id' in player
        assert 'username' in player
        assert 'game_name' in player
        assert 'joined_at' in player
        assert player['user_id'] == user.id
        assert player['username'] == user.username
        assert player['game_name'] == user.first_name
