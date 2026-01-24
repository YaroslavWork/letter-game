"""
Tests for Room Detail endpoint functionality.
"""
import pytest
from rest_framework import status
import uuid


@pytest.mark.django_db
class TestRoomDetailView:
    """Test suite for RoomDetailView."""

    def test_get_room_detail_success(self, api_client):
        """Test successful retrieval of room details."""
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
        
        # Get room details
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(room.id)
        assert response.data['name'] == 'Test Room'
        assert response.data['host_id'] == host.id
        assert response.data['host_username'] == host.username
        assert response.data['host_game_name'] == host.first_name
        assert response.data['is_active'] is True

    def test_get_room_detail_returns_players_list(self, api_client):
        """Test that room detail returns players list."""
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
        
        # Add multiple players
        player1 = User.objects.create_user(
            username='player1',
            email='player1@example.com',
            password='pass123',
            first_name='Player1'
        )
        player2 = User.objects.create_user(
            username='player2',
            email='player2@example.com',
            password='pass123',
            first_name='Player2'
        )
        RoomPlayer.objects.create(room=room, user=player1)
        RoomPlayer.objects.create(room=room, user=player2)
        
        # Login as any user
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        # Create testuser if not exists
        testuser = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Get room details
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'players' in response.data
        assert isinstance(response.data['players'], list)
        assert len(response.data['players']) == 3
        assert 'player_count' in response.data
        assert response.data['player_count'] == 3
        
        # Check players structure
        player_usernames = [p['username'] for p in response.data['players']]
        assert 'host' in player_usernames
        assert 'player1' in player_usernames
        assert 'player2' in player_usernames
        
        # Check player data structure
        for player in response.data['players']:
            assert 'id' in player
            assert 'user_id' in player
            assert 'username' in player
            assert 'game_name' in player
            assert 'joined_at' in player

    def test_get_room_detail_returns_game_session_if_exists(self, api_client):
        """Test that room detail returns game session if it exists."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer, GameSession
        User = get_user_model()
        
        # Create host and room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Create game session
        game_session = GameSession.objects.create(
            room=room,
            letter='A',
            is_random_letter=False,
            selected_types=['panstwo', 'miasto'],
            total_rounds=3,
            current_round=1
        )
        
        # Login
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
        
        # Get room details
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'game_session' in response.data
        assert response.data['game_session'] is not None
        assert response.data['game_session']['letter'] == 'A'
        assert response.data['game_session']['is_random_letter'] is False
        assert response.data['game_session']['selected_types'] == ['panstwo', 'miasto']
        assert response.data['game_session']['total_rounds'] == 3
        assert response.data['game_session']['current_round'] == 1

    def test_get_room_detail_no_game_session(self, api_client):
        """Test that room detail returns null game_session if it doesn't exist."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and room without game session
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        # Login
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
        
        # Get room details
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'game_session' in response.data
        # Game session might be None or empty dict depending on serializer
        assert response.data['game_session'] is None or response.data['game_session'] == {}

    def test_get_room_detail_non_existent_room(self, api_client):
        """Test that non-existent room returns 404."""
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
        
        # Try to get non-existent room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        fake_uuid = str(uuid.uuid4())
        detail_url = f'/api/rooms/{fake_uuid}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_room_detail_unauthenticated(self, api_client):
        """Test that unauthenticated access returns 401."""
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
        
        # Try to get room details without authentication
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_room_detail_response_structure(self, api_client):
        """Test that room detail response has correct structure."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer, GameSession
        User = get_user_model()
        
        # Create host and room with game session
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123',
            first_name='HostPlayer'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        GameSession.objects.create(room=room)
        
        # Login
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
        
        # Get room details
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
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
        assert isinstance(response.data['host_username'], str)
        assert isinstance(response.data['is_active'], bool)
        assert isinstance(response.data['players'], list)
        assert isinstance(response.data['player_count'], int)

    def test_get_room_detail_only_get_method(self, api_client):
        """Test that room detail endpoint only accepts GET requests."""
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
        
        # Login
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
        detail_url = f'/api/rooms/{room.id}/'
        
        # GET should work
        get_response = api_client.get(detail_url)
        assert get_response.status_code == status.HTTP_200_OK
        
        # POST should not work
        post_response = api_client.post(detail_url, {}, format='json')
        assert post_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # PUT should not work
        put_response = api_client.put(detail_url, {}, format='json')
        assert put_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # DELETE should not work
        delete_response = api_client.delete(detail_url)
        assert delete_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_get_room_detail_invalid_token(self, api_client):
        """Test room detail with invalid token returns 401."""
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
        
        # Try to get room details with invalid token
        api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_12345')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_room_detail_inactive_room(self, api_client):
        """Test that inactive room details can still be retrieved."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create inactive room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room', is_active=False)
        RoomPlayer.objects.create(room=room, user=host)
        
        # Login
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
        
        # Get inactive room details (should still work)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_active'] is False

    def test_get_room_detail_any_user_can_access(self, api_client):
        """Test that any authenticated user can access room details (not just members)."""
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
        
        # Create user not in room
        outsider = User.objects.create_user(
            username='outsider',
            email='outsider@example.com',
            password='pass123'
        )
        
        # Login as outsider
        login_url = '/api/login/'
        login_data = {
            'username': 'outsider',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Get room details (should work even if not a member)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(room.id)
        assert response.data['name'] == 'Test Room'

    def test_get_room_detail_player_count_matches_players_list(self, api_client):
        """Test that player_count matches the length of players list."""
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
        
        # Add more players
        for i in range(3):
            player = User.objects.create_user(
                username=f'player{i}',
                email=f'player{i}@example.com',
                password='pass123'
            )
            RoomPlayer.objects.create(room=room, user=player)
        
        # Login
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
        
        # Get room details
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['player_count'] == len(response.data['players'])
        assert response.data['player_count'] == 4  # host + 3 players

    def test_get_room_detail_game_session_structure(self, api_client):
        """Test that game session in response has correct structure."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer, GameSession
        User = get_user_model()
        
        # Create host and room with game session
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room')
        RoomPlayer.objects.create(room=room, user=host)
        
        game_session = GameSession.objects.create(
            room=room,
            letter='B',
            is_random_letter=True,
            selected_types=['zwierze', 'kolor'],
            total_rounds=5,
            current_round=2,
            round_timer_seconds=90
        )
        
        # Login
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
        
        # Get room details
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        detail_url = f'/api/rooms/{room.id}/'
        response = api_client.get(detail_url)
        
        assert response.status_code == status.HTTP_200_OK
        game_session_data = response.data['game_session']
        
        # Check game session fields
        assert 'letter' in game_session_data
        assert 'is_random_letter' in game_session_data
        assert 'selected_types' in game_session_data
        assert 'total_rounds' in game_session_data
        assert 'current_round' in game_session_data
        assert game_session_data['letter'] == 'B'
        assert game_session_data['is_random_letter'] is True
        assert game_session_data['selected_types'] == ['zwierze', 'kolor']
        assert game_session_data['total_rounds'] == 5
        assert game_session_data['current_round'] == 2
