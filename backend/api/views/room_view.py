from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from ..models import Room, RoomPlayer
from ..serializers.room_serializer import (
    RoomSerializer, CreateRoomSerializer, JoinRoomSerializer, RoomPlayerSerializer
)
from ..utils import broadcast_room_update


class CreateRoomView(APIView):
    permission_classes = (IsAuthenticated,)
    
    def post(self, request):
        serializer = CreateRoomSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            room = serializer.save()
            room.refresh_from_db()
            broadcast_room_update(room)
            room_serializer = RoomSerializer(room)
            return Response(room_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class JoinRoomView(APIView):
    """
    API view to join an existing room.
    """
    permission_classes = (IsAuthenticated,)
    
    def post(self, request):
        serializer = JoinRoomSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            room_player = serializer.save()
            room = room_player.room
            # Refresh room to get updated players
            room.refresh_from_db()
            # Broadcast update to all clients
            broadcast_room_update(room)
            room_serializer = RoomSerializer(room)
            return Response(room_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LeaveRoomView(APIView):
    """
    API view to leave a room.
    """
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        room_player = get_object_or_404(RoomPlayer, room=room, user=request.user)
        
        # Host cannot leave the room (they need to delete it instead)
        if room.host == request.user:
            return Response(
                {'error': 'Host cannot leave the room. Please delete the room instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        room = room_player.room
        room_player.delete()
        # Refresh room to get updated players
        room.refresh_from_db()
        # Broadcast update to all clients
        broadcast_room_update(room)
        return Response({'message': 'Left room successfully'}, status=status.HTTP_200_OK)


class RoomDetailView(APIView):
    """
    API view to get room details.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        serializer = RoomSerializer(room)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DeletePlayerView(APIView):
    """
    API view for host to delete a player from the room.
    """
    permission_classes = (IsAuthenticated,)
    
    def delete(self, request, room_id, player_id):
        room = get_object_or_404(Room, id=room_id)
        
        # Only host can delete players
        if room.host != request.user:
            return Response(
                {'error': 'Only the host can delete players.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Cannot delete host
        room_player = get_object_or_404(RoomPlayer, id=player_id, room=room)
        if room_player.user == room.host:
            return Response(
                {'error': 'Cannot delete the host.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        room = room_player.room
        room_player.delete()
        # Refresh room to get updated players
        room.refresh_from_db()
        # Broadcast update to all clients
        broadcast_room_update(room)
        return Response({'message': 'Player removed successfully'}, status=status.HTTP_200_OK)


class DeleteRoomView(APIView):
    """
    API view for host to delete the entire room.
    """
    permission_classes = (IsAuthenticated,)
    
    def delete(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        
        # Only host can delete the room
        if room.host != request.user:
            return Response(
                {'error': 'Only the host can delete the room.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        room.is_active = False
        room.save()
        return Response({'message': 'Room deleted successfully'}, status=status.HTTP_200_OK)
