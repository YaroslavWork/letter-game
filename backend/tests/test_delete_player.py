"""
Tests for Delete Player endpoint functionality.
"""
import pytest
from rest_framework import status
import uuid


@pytest.mark.django_db
class TestDeletePlayerView:
    """Test suite for DeletePlayerView."""

    def test_delete_player_host_can_delete(self, api_client):
        """Test that host can delete a player."""
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
        host_player = RoomPlayer.objects.create(room=room, user=host)
        
        # Create and add player to room
        player = User.objects.create_user(
            username='player',
            email='player@example.com',
            password='pass123'
        )
        room_player = RoomPlayer.objects.create(room=room, user=player)
        
        # Verify player exists
        assert RoomPlayer.objects.filter(room=room, user=player).exists()
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Delete player
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/players/{room_player.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        assert 'Player removed successfully' in response.data['message']
        
        # Verify player is removed
        assert not RoomPlayer.objects.filter(room=room, user=player).exists()
        # Host should still be in room
        assert RoomPlayer.objects.filter(room=room, user=host).exists()

    def test_delete_player_non_host_cannot_delete(self, api_client):
        """Test that non-host cannot delete players."""
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
        
        # Create and add players
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
        room_player1 = RoomPlayer.objects.create(room=room, user=player1)
        RoomPlayer.objects.create(room=room, user=player2)
        
        # Login as player1 (non-host)
        login_url = '/api/login/'
        login_data = {
            'username': 'player1',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Try to delete player2 as non-host
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/players/{room_player1.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'error' in response.data
        assert 'Only the host can delete players' in response.data['error']
        
        # Verify player still exists
        assert RoomPlayer.objects.filter(room=room, user=player1).exists()

    def test_delete_player_cannot_delete_host(self, api_client):
        """Test that host cannot be deleted."""
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
        host_player = RoomPlayer.objects.create(room=room, user=host)
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Try to delete host (should fail)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/players/{host_player.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'Cannot delete the host' in response.data['error']
        
        # Verify host still exists in room
        assert RoomPlayer.objects.filter(room=room, user=host).exists()

    def test_delete_player_non_existent_player(self, api_client):
        """Test deleting non-existent player returns 404."""
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
        
        # Try to delete non-existent player
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        fake_player_id = 99999
        delete_url = f'/api/rooms/{room.id}/players/{fake_player_id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_player_non_existent_room(self, api_client):
        """Test deleting player from non-existent room returns 404."""
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
        
        # Try to delete player from non-existent room
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        fake_room_id = str(uuid.uuid4())
        fake_player_id = 1
        delete_url = f'/api/rooms/{fake_room_id}/players/{fake_player_id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_player_player_from_different_room(self, api_client):
        """Test deleting player from different room returns 404."""
        from django.contrib.auth import get_user_model
        from api.models import Room, RoomPlayer
        User = get_user_model()
        
        # Create host and two rooms
        host = User.objects.create_user(
            username='host',
            email='host@example.com',
            password='pass123'
        )
        room1 = Room.objects.create(host=host, name='Room 1')
        room2 = Room.objects.create(host=host, name='Room 2')
        RoomPlayer.objects.create(room=room1, user=host)
        RoomPlayer.objects.create(room=room2, user=host)
        
        # Add player to room1
        player = User.objects.create_user(
            username='player',
            email='player@example.com',
            password='pass123'
        )
        room1_player = RoomPlayer.objects.create(room=room1, user=player)
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Try to delete player from room1 using room2's URL
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room2.id}/players/{room1_player.id}/delete/'
        response = api_client.delete(delete_url)
        
        # Should return 404 because player doesn't belong to room2
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        # Verify player still exists in room1
        assert RoomPlayer.objects.filter(room=room1, user=player).exists()

    def test_delete_player_unauthenticated(self, api_client):
        """Test deleting player without authentication returns 401."""
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
        room_player = RoomPlayer.objects.create(room=room, user=player)
        
        # Try to delete without authentication
        delete_url = f'/api/rooms/{room.id}/players/{room_player.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Verify player still exists
        assert RoomPlayer.objects.filter(room=room, user=player).exists()

    def test_delete_player_multiple_players(self, api_client):
        """Test deleting multiple players from room."""
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
        player3 = User.objects.create_user(
            username='player3',
            email='player3@example.com',
            password='pass123'
        )
        room_player1 = RoomPlayer.objects.create(room=room, user=player1)
        room_player2 = RoomPlayer.objects.create(room=room, user=player2)
        room_player3 = RoomPlayer.objects.create(room=room, user=player3)
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        # Delete player1
        delete_url1 = f'/api/rooms/{room.id}/players/{room_player1.id}/delete/'
        response1 = api_client.delete(delete_url1)
        assert response1.status_code == status.HTTP_200_OK
        assert not RoomPlayer.objects.filter(room=room, user=player1).exists()
        
        # Delete player2
        delete_url2 = f'/api/rooms/{room.id}/players/{room_player2.id}/delete/'
        response2 = api_client.delete(delete_url2)
        assert response2.status_code == status.HTTP_200_OK
        assert not RoomPlayer.objects.filter(room=room, user=player2).exists()
        
        # Delete player3
        delete_url3 = f'/api/rooms/{room.id}/players/{room_player3.id}/delete/'
        response3 = api_client.delete(delete_url3)
        assert response3.status_code == status.HTTP_200_OK
        assert not RoomPlayer.objects.filter(room=room, user=player3).exists()
        
        # Verify only host remains
        assert RoomPlayer.objects.filter(room=room).count() == 1
        assert RoomPlayer.objects.filter(room=room, user=host).exists()

    def test_delete_player_response_structure(self, api_client):
        """Test that delete player response has correct structure."""
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
        room_player = RoomPlayer.objects.create(room=room, user=player)
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Delete player
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/players/{room_player.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, dict)
        assert 'message' in response.data
        assert isinstance(response.data['message'], str)

    def test_delete_player_only_delete_method(self, api_client):
        """Test that delete player endpoint only accepts DELETE requests."""
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
        room_player = RoomPlayer.objects.create(room=room, user=player)
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/players/{room_player.id}/delete/'
        
        # DELETE should work
        delete_response = api_client.delete(delete_url)
        assert delete_response.status_code == status.HTTP_200_OK
        
        # Re-add player for other method tests
        room_player2 = RoomPlayer.objects.create(room=room, user=player)
        delete_url2 = f'/api/rooms/{room.id}/players/{room_player2.id}/delete/'
        
        # GET should not work
        get_response = api_client.get(delete_url2)
        assert get_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # POST should not work
        post_response = api_client.post(delete_url2, {}, format='json')
        assert post_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        
        # PUT should not work
        put_response = api_client.put(delete_url2, {}, format='json')
        assert put_response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_delete_player_invalid_token(self, api_client):
        """Test deleting player with invalid token returns 401."""
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
        room_player = RoomPlayer.objects.create(room=room, user=player)
        
        # Try to delete with invalid token
        api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_12345')
        delete_url = f'/api/rooms/{room.id}/players/{room_player.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_player_player_count_decreases(self, api_client):
        """Test that player count decreases after deleting player."""
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
        room_player1 = RoomPlayer.objects.create(room=room, user=player1)
        RoomPlayer.objects.create(room=room, user=player2)
        
        # Verify initial count
        room.refresh_from_db()
        initial_count = room.players.count()
        assert initial_count == 3
        
        # Login as host
        login_url = '/api/login/'
        login_data = {
            'username': 'host',
            'password': 'pass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Delete player1
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/players/{room_player1.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify count decreased
        room.refresh_from_db()
        assert room.players.count() == initial_count - 1
        assert not RoomPlayer.objects.filter(room=room, user=player1).exists()
        assert RoomPlayer.objects.filter(room=room, user=player2).exists()
        assert RoomPlayer.objects.filter(room=room, user=host).exists()

    def test_delete_player_outsider_cannot_delete(self, api_client):
        """Test that user not in room cannot delete players."""
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
        room_player = RoomPlayer.objects.create(room=room, user=player)
        
        # Create outsider (not in room)
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
        
        # Try to delete player
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        delete_url = f'/api/rooms/{room.id}/players/{room_player.id}/delete/'
        response = api_client.delete(delete_url)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'error' in response.data
        assert 'Only the host can delete players' in response.data['error']
        
        # Verify player still exists
        assert RoomPlayer.objects.filter(room=room, user=player).exists()
