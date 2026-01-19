from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from ..models import Room, GameSession, GAME_TYPE_CHOICES
from ..serializers.game_session_serializer import GameSessionSerializer, UpdateGameSessionSerializer
from ..utils import broadcast_room_update


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
