"""
Tests for Delete Room endpoint functionality.
"""
import pytest
from rest_framework import status
import uuid


@pytest.mark.django_db
class TestDeleteRoomView:
    """Test suite for DeleteRoomView."""

    def test_delete_room_host_can_delete(self, api_client):
        """Test that host can delete room."""
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
        
        # Delete room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        assert 'Room deleted successfully' in response.data['message']
        
        # Verify room is marked as inactive
        room.refresh_from_db()
        assert room.is_active is False

    def test_delete_room_non_host_cannot_delete(self, api_client):
        """Test that non-host cannot delete room."""
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
        
        # Try to delete room as non-host
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'error' in response.data
        assert 'Only the host can delete the room' in response.data['error']
        
        # Verify room is still active
        room.refresh_from_db()
        assert room.is_active is True

    def test_delete_room_removes_all_players(self, api_client):
        """Test that deleting room removes all players."""
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
        
        # Add multiple players
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
        
        # Verify players exist before deletion
        assert RoomPlayer.objects.filter(room=room).count() == 3
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Delete room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify all players are removed
        assert RoomPlayer.objects.filter(room=room).count() == 0
        assert not RoomPlayer.objects.filter(room=room, user=host).exists()
        assert not RoomPlayer.objects.filter(room=room, user=player1).exists()
        assert not RoomPlayer.objects.filter(room=room, user=player2).exists()

    def test_delete_room_removes_game_session(self, api_client):
        """Test that deleting room removes game session."""
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
            selected_types=['panstwo', 'miasto']
        )
        
        # Verify game session exists
        assert GameSession.objects.filter(room=room).exists()
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Delete room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify game session is deleted
        assert not GameSession.objects.filter(room=room).exists()

    def test_delete_room_without_game_session(self, api_client):
        """Test that deleting room without game session still works."""
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
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Delete room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        room.refresh_from_db()
        assert room.is_active is False

    def test_delete_room_unauthenticated(self, api_client):
        """Test deleting room without authentication returns 401."""
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
        
        # Try to delete without authentication
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Verify room is still active
        room.refresh_from_db()
        assert room.is_active is True

    def test_delete_room_non_existent_room(self, api_client):
        """Test deleting non-existent room returns 404."""
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
        
        # Try to delete non-existent room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        fake_uuid = str(uuid.uuid4())
        delete_url = f'/api/rooms/{fake_uuid}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_room_only_delete_method(self, api_client):
        """Test that delete room endpoint only accepts DELETE requests."""
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
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        
        # DELETE should work
        delete_response = api_client.delete(delete_url)
        assert delete_response.status_code == status.HTTP_200_OK
        
        # Recreate room for other method tests
        room2 = Room.objects.create(host=host, name='Test Room 2')
        RoomPlayer.objects.create(room=room2, user=host)
        delete_url2 = f'/api/rooms/{room2.id}/delete/'
        
        # GET should not work
        get_response = api_client.get(delete_url2)
        assert get_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # POST should not work
        post_response = api_client.post(delete_url2, {}, format='json')
        assert post_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # PUT should not work
        put_response = api_client.put(delete_url2, {}, format='json')
        assert put_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_delete_room_invalid_token(self, api_client):
        """Test deleting room with invalid token returns 401."""
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
        
        # Try to delete with invalid token
        api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_12345')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_room_response_structure(self, api_client):
        """Test that delete room response has correct structure."""
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
        
        # Delete room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, dict)
        assert 'message' in response.data
        assert isinstance(response.data['message'], str)

    def test_delete_room_outsider_cannot_delete(self, api_client):
        """Test that user not in room cannot delete it."""
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
        
        # Try to delete room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'error' in response.data
        assert 'Only the host can delete the room' in response.data['error']

    def test_delete_room_marks_as_inactive_not_deleted(self, api_client):
        """Test that room is marked as inactive, not actually deleted from database."""
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
        room_id = room.id
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Delete room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify room still exists in database but is inactive
        assert Room.objects.filter(id=room_id).exists()
        room.refresh_from_db()
        assert room.is_active is False
        assert room.name == 'Test Room'  # Room data still exists

    def test_delete_room_multiple_players_removed(self, api_client):
        """Test that deleting room removes all players including host."""
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
        
        # Add many players
        players = []
        for i in range(5):
            player = User.objects.create_user(
                username=f'player{i}',
                email=f'player{i}@example.com',
                password='pass123'
            )
            RoomPlayer.objects.create(room=room, user=player)
            players.append(player)
        
        # Verify all players exist
        assert RoomPlayer.objects.filter(room=room).count() == 6  # host + 5 players
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Delete room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify all players removed (including host)
        assert RoomPlayer.objects.filter(room=room).count() == 0
        assert not RoomPlayer.objects.filter(room=room, user=host).exists()
        for player in players:
            assert not RoomPlayer.objects.filter(room=room, user=player).exists()
