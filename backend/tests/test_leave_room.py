"""
Tests for Leave Room endpoint functionality.
"""
import pytest
from rest_framework import status
import uuid


@pytest.mark.django_db
class TestLeaveRoomView:
    """Test suite for LeaveRoomView."""

    def test_leave_room_success(self, api_client):
        """Test successful room leave by a player."""
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
        
        # Create player and add to room
        player = User.objects.create_user(
            username='player',
            email='player@example.com',
            password='pass123'
        )
        RoomPlayer.objects.create(room=room, user=player)
        
        # Login as player
        login_url = '/api/login/'
        login_data = {
            'username': 'player',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Leave room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        assert 'Left room successfully' in response.data['message']
        
        # Verify player is removed from room
        assert not RoomPlayer.objects.filter(room=room, user=player).exists()
        assert RoomPlayer.objects.filter(room=room, user=host).exists()  # Host still in

    def test_leave_room_host_cannot_leave(self, api_client):
        """Test that host cannot leave room (must delete instead)."""
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
        
        # Try to leave room as host
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'Host cannot leave' in response.data['error']
        assert 'delete' in response.data['error'].lower()
        
        # Verify host is still in room
        assert RoomPlayer.objects.filter(room=room, user=host).exists()

    def test_leave_room_not_in_room(self, api_client):
        """Test leaving room when user is not a member returns 404."""
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
        user = User.objects.create_user(
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
        
        # Try to leave room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_leave_room_unauthenticated(self, api_client):
        """Test leaving room without authentication returns 401."""
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
        
        # Try to leave without authentication
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_leave_room_invalid_room_id(self, api_client):
        """Test leaving non-existent room returns 404."""
        from django.contrib.auth import get_user_model
        from api.models import RoomPlayer
        User = get_user_model()
        
        # Create user
        user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123'
        )
        
        # Login
        login_url = '/api/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Try to leave non-existent room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        fake_uuid = str(uuid.uuid4())
        leave_url = f'/api/rooms/{fake_uuid}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_leave_room_player_count_decreases(self, api_client):
        """Test that player count decreases after leaving."""
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
        
        # Create and add multiple players
        player1 = User.objects.create_user(
            username='player1',
            email='player1@example.com',
            password='pass123'
        )
        player2 = User.objects.create_user(
            username='player2',
            email='player2@example.com',
            password='pass123'
        )
        RoomPlayer.objects.create(room=room, user=player1)
        RoomPlayer.objects.create(room=room, user=player2)
        
        # Verify initial count
        room.refresh_from_db()
        initial_count = room.players.count()
        assert initial_count == 3
        
        # Login as player1
        login_url = '/api/login/'
        login_data = {
            'username': 'player1',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Leave room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify count decreased
        room.refresh_from_db()
        assert room.players.count() == initial_count - 1
        assert not RoomPlayer.objects.filter(room=room, user=player1).exists()
        assert RoomPlayer.objects.filter(room=room, user=player2).exists()
        assert RoomPlayer.objects.filter(room=room, user=host).exists()

    def test_leave_room_multiple_players(self, api_client):
        """Test multiple players leaving the same room."""
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
        
        # Create and add multiple players
        player1 = User.objects.create_user(
            username='player1',
            email='player1@example.com',
            password='pass123'
        )
        player2 = User.objects.create_user(
            username='player2',
            email='player2@example.com',
            password='pass123'
        )
        RoomPlayer.objects.create(room=room, user=player1)
        RoomPlayer.objects.create(room=room, user=player2)
        
        # Player1 leaves
        login_url = '/api/login/'
        login_data1 = {
            'username': 'player1',
            'password': 'pass123'
        }
        login_response1 = api_client.post(login_url, login_data1, format='json')
        access_token1 = login_response1.data['access']
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token1}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response1 = api_client.post(leave_url, {}, format='json')
        assert response1.status_code == status.HTTP_200_OK
        
        # Player2 leaves
        login_data2 = {
            'username': 'player2',
            'password': 'pass123'
        }
        login_response2 = api_client.post(login_url, login_data2, format='json')
        access_token2 = login_response2.data['access']
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token2}')
        response2 = api_client.post(leave_url, {}, format='json')
        assert response2.status_code == status.HTTP_200_OK
        
        # Verify only host remains
        room.refresh_from_db()
        assert room.players.count() == 1
        assert RoomPlayer.objects.filter(room=room, user=host).exists()
        assert not RoomPlayer.objects.filter(room=room, user=player1).exists()
        assert not RoomPlayer.objects.filter(room=room, user=player2).exists()

    def test_leave_room_response_structure(self, api_client):
        """Test that leave room response has correct structure."""
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
        
        # Create player and add to room
        player = User.objects.create_user(
            username='player',
            email='player@example.com',
            password='pass123'
        )
        RoomPlayer.objects.create(room=room, user=player)
        
        # Login as player
        login_url = '/api/login/'
        login_data = {
            'username': 'player',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Leave room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, dict)
        assert 'message' in response.data
        assert isinstance(response.data['message'], str)

    def test_leave_room_only_post_method(self, api_client):
        """Test that leave room endpoint only accepts POST requests."""
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
        
        # Create player and add to room
        player = User.objects.create_user(
            username='player',
            email='player@example.com',
            password='pass123'
        )
        RoomPlayer.objects.create(room=room, user=player)
        
        # Login as player
        login_url = '/api/login/'
        login_data = {
            'username': 'player',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        
        # POST should work
        post_response = api_client.post(leave_url, {}, format='json')
        assert post_response.status_code == status.HTTP_200_OK
        
        # Re-add player for other method tests
        RoomPlayer.objects.create(room=room, user=player)
        
        # GET should not work
        get_response = api_client.get(leave_url)
        assert get_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # PUT should not work
        put_response = api_client.put(leave_url, {}, format='json')
        assert put_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # DELETE should not work
        delete_response = api_client.delete(leave_url)
        assert delete_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_leave_room_invalid_token(self, api_client):
        """Test leaving room with invalid token returns 401."""
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
        
        # Try to leave with invalid token
        api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_12345')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_leave_room_inactive_room(self, api_client):
        """Test leaving inactive room (should still work if user is in it)."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and inactive room
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room = Room.objects.create(host=host, name='Test Room', is_active=False)
        RoomPlayer.objects.create(room=room, user=host)
        
        # Create player and add to room
        player = User.objects.create_user(
            username='player',
            email='player@example.com',
            password='pass123'
        )
        RoomPlayer.objects.create(room=room, user=player)
        
        # Login as player
        login_url = '/api/login/'
        login_data = {
            'username': 'player',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Leave inactive room (should still work)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        # Should succeed because user is in the room
        assert response.status_code == status.HTTP_200_OK
        assert not RoomPlayer.objects.filter(room=room, user=player).exists()

    def test_leave_room_host_after_others_leave(self, api_client):
        """Test that host still cannot leave even after other players leave."""
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
        
        # Create and add player
        player = User.objects.create_user(
            username='player',
            email='player@example.com',
            password='pass123'
        )
        RoomPlayer.objects.create(room=room, user=player)
        
        # Player leaves
        login_url = '/api/login/'
        login_data_player = {
            'username': 'player',
            'password': 'pass123'
        }
        login_response_player = api_client.post(login_url, login_data_player, format='json')
        access_token_player = login_response_player.data['access']
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token_player}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        api_client.post(leave_url, {}, format='json')
        
        # Now host tries to leave (should fail)
        login_data_host = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response_host = api_client.post(login_url, login_data_host, format='json')
        access_token_host = login_response_host.data['access']
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token_host}')
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'Host cannot leave' in response.data['error']

    def test_leave_room_empty_body(self, api_client):
        """Test leaving room with empty POST body (should work)."""
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
        
        # Create player and add to room
        player = User.objects.create_user(
            username='player',
            email='player@example.com',
            password='pass123'
        )
        RoomPlayer.objects.create(room=room, user=player)
        
        # Login as player
        login_url = '/api/login/'
        login_data = {
            'username': 'player',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Leave room with empty body
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        leave_url = f'/api/rooms/{room.id}/leave/'
        response = api_client.post(leave_url, {}, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert not RoomPlayer.objects.filter(room=room, user=player).exists()
