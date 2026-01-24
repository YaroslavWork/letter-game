"""
Tests for Join Room endpoint functionality.
"""
import pytest
from rest_framework import status
import uuid


@pytest.mark.django_db
class TestJoinRoomView:
    """Test suite for JoinRoomView."""

    def test_join_room_success(self, api_client):
        """Test successful room join."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host user and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        
        room = Room.objects.create(
            host=host,
            name='Test Room'
        )
        RoomPlayer.objects.create(room=room, user=host)
        
        # Create joining user and login
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
        
        # Join room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {
            'room_id': str(room.id)
        }
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(room.id)
        assert response.data['player_count'] == 2
        assert len(response.data['players']) == 2
        
        # Verify user is in players list
        player_usernames = [p['username'] for p in response.data['players']]
        assert 'testuser' in player_usernames
        assert 'host' in player_usernames
        
        # Verify in database
        assert RoomPlayer.objects.filter(room=room, user=user).exists()

    def test_join_room_unauthenticated(self, api_client):
        """Test room join without authentication returns 401."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Try to join without authentication
        join_url = '/api/rooms/join/'
        join_data = {
            'room_id': str(room.id)
        }
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_join_room_invalid_room_id(self, api_client):
        """Test joining non-existent room returns 400."""
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
        
        # Try to join non-existent room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        fake_uuid = str(uuid.uuid4())
        join_data = {
            'room_id': fake_uuid
        }
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'room_id' in response.data

    def test_join_room_inactive_room(self, api_client):
        """Test joining inactive room returns 400."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and inactive room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(
            host=host,
            name='Test Room',
            is_active=False  # Inactive room
        )
        RoomPlayer.objects.create(room=room, user=host)
        
        # Create joining user and login
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
        
        # Try to join inactive room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {
            'room_id': str(room.id)
        }
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'room_id' in response.data

    def test_join_room_already_in_room(self, api_client):
        """Test joining room when already in it returns 400."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Create user already in room
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        RoomPlayer.objects.create(room=room, user=user)
        
        # Login
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Try to join again
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {
            'room_id': str(room.id)
        }
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'non_field_errors' in response.data or len(response.data) > 0

    def test_join_room_missing_room_id(self, api_client):
        """Test joining room without room_id returns 400."""
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
        
        # Try to join without room_id
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {}
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'room_id' in response.data

    def test_join_room_invalid_uuid_format(self, api_client):
        """Test joining room with invalid UUID format returns 400."""
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
        
        # Try to join with invalid UUID format
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {
            'room_id': 'not-a-valid-uuid'
        }
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'room_id' in response.data

    def test_join_room_multiple_users(self, api_client):
        """Test multiple users joining the same room."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Create first user and join
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
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token1}')
        join_url = '/api/rooms/join/'
        join_data = {'room_id': str(room.id)}
        response1 = api_client.post(join_url, join_data, format='json')
        
        assert response1.status_code == status.HTTP_200_OK
        assert response1.data['player_count'] == 2
        
        # Create second user and join
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
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token2}')
        response2 = api_client.post(join_url, join_data, format='json')
        
        assert response2.status_code == status.HTTP_200_OK
        assert response2.data['player_count'] == 3
        
        # Verify all users are in players list
        player_usernames = [p['username'] for p in response2.data['players']]
        assert 'host' in player_usernames
        assert 'user1' in player_usernames
        assert 'user2' in player_usernames

    def test_join_room_response_structure(self, api_client):
        """Test that join room response has correct structure."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123',
            first_name='HostPlayer'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Create joining user and login
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
        
        # Join room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {'room_id': str(room.id)}
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
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
        assert isinstance(response.data['players'], list)
        assert isinstance(response.data['player_count'], int)
        assert response.data['player_count'] == len(response.data['players'])

    def test_join_room_player_added_to_list(self, api_client):
        """Test that joined player appears in players list."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Create joining user and login
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
        
        # Join room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {'room_id': str(room.id)}
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Check player is in list
        player_data = None
        for player in response.data['players']:
            if player['username'] == 'testuser':
                player_data = player
                break
        
        assert player_data is not None
        assert player_data['user_id'] == user.id
        assert player_data['username'] == user.username
        assert player_data['game_name'] == user.first_name
        assert 'id' in player_data
        assert 'joined_at' in player_data

    def test_join_room_only_post_method(self, api_client):
        """Test that join room endpoint only accepts POST requests."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
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
        join_url = '/api/rooms/join/'
        join_data = {'room_id': str(room.id)}
        
        # POST should work
        post_response = api_client.post(join_url, join_data, format='json')
        assert post_response.status_code == status.HTTP_200_OK
        
        # GET should not work
        get_response = api_client.get(join_url)
        assert get_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # PUT should not work
        put_response = api_client.put(join_url, join_data, format='json')
        assert put_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # DELETE should not work
        delete_response = api_client.delete(join_url)
        assert delete_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_join_room_host_can_join_own_room(self, api_client):
        """Test that host cannot join their own room (already in it)."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Try to join own room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {'room_id': str(room.id)}
        response = api_client.post(join_url, join_data, format='json')
        
        # Should fail because host is already in room
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_join_room_invalid_token(self, api_client):
        """Test room join with invalid token returns 401."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Try to join with invalid token
        api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_12345')
        join_url = '/api/rooms/join/'
        join_data = {'room_id': str(room.id)}
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_join_room_empty_room_id(self, api_client):
        """Test joining room with empty room_id returns 400."""
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
        
        # Try to join with empty room_id
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {'room_id': ''}
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'room_id' in response.data

    def test_join_room_player_count_increases(self, api_client):
        """Test that player count increases after joining."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Get initial player count
        room.refresh_from_db()
        initial_count = room.players.count()
        assert initial_count == 1
        
        # Create user and join
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
        
        # Join room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        join_url = '/api/rooms/join/'
        join_data = {'room_id': str(room.id)}
        response = api_client.post(join_url, join_data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['player_count'] == initial_count + 1
        
        # Verify in database
        room.refresh_from_db()
        assert room.players.count() == initial_count + 1
