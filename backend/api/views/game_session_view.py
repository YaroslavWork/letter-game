from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
import random
import string
from ..models import Room, GameSession, GAME_TYPE_CHOICES
from ..serializers.game_session_serializer import GameSessionSerializer, UpdateGameSessionSerializer
from ..utils import broadcast_room_update, broadcast_game_started


class GetGameTypesView(APIView):
    """
    API view to get all available game types.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        game_types = [{'key': choice[0], 'label': choice[1]} for choice in GAME_TYPE_CHOICES]
        return Response(game_types, status=status.HTTP_200_OK)


class GetGameSessionView(APIView):
    """
    API view to get game session for a room.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Check if user is in the room
        from ..models import RoomPlayer
        if not RoomPlayer.objects.filter(room=room, user=request.user).exists():
            return Response(
                {'error': 'You are not a member of this room.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session, created = GameSession.objects.get_or_create(room=room)
        serializer = GameSessionSerializer(game_session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UpdateGameSessionView(APIView):
    """
    API view for host to update game session rules (letter and types).
    """
    permission_classes = (IsAuthenticated,)
    
    def put(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Only host can update game session
        if room.host != request.user:
            return Response(
                {'error': 'Only the host can update game rules.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session, created = GameSession.objects.get_or_create(room=room)
        serializer = UpdateGameSessionSerializer(game_session, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            # Refresh room to get updated game session
            room.refresh_from_db()
            # Broadcast update to all clients
            broadcast_room_update(room)
            # Return full game session data
            full_serializer = GameSessionSerializer(game_session)
            return Response(full_serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StartGameSessionView(APIView):
    """
    API view for host to start the game session.
    Generates random letter if needed and broadcasts game_started to all players.
    """
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Only host can start the game
        if room.host != request.user:
            return Response(
                {'error': 'Only the host can start the game.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session, created = GameSession.objects.get_or_create(room=room)
        
        # Check if game types are configured
        if not game_session.selected_types or len(game_session.selected_types) == 0:
            return Response(
                {'error': 'Please configure game types before starting the game.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # If random letter, generate one now
        if game_session.is_random_letter and not game_session.letter:
            # Generate a random letter (excluding rarely used letters like Q, X, Y, Z)
            # Using common Polish alphabet letters
            common_letters = list(string.ascii_uppercase)
            # Remove some rare letters for better game experience
            rare_letters = ['Q', 'X', 'Y']
            for letter in rare_letters:
                if letter in common_letters:
                    common_letters.remove(letter)
            
            game_session.letter = random.choice(common_letters)
            game_session.save()
        
        # If not random but no letter set, return error
        if not game_session.is_random_letter and not game_session.letter:
            return Response(
                {'error': 'Please set a letter or enable random letter before starting the game.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Broadcast game started message to all players
        broadcast_game_started(room, game_session)
        
        # Return full game session data
        serializer = GameSessionSerializer(game_session)
        return Response(serializer.data, status=status.HTTP_200_OK)
