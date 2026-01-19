from rest_framework import serializers
from django.contrib.auth.models import User
from ..models import Room, RoomPlayer
from .game_session_serializer import GameSessionSerializer


class RoomPlayerSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    game_name = serializers.CharField(source='user.first_name', read_only=True)
    
    class Meta:
        model = RoomPlayer
        fields = ('id', 'user_id', 'username', 'game_name', 'joined_at')


class RoomSerializer(serializers.ModelSerializer):
    host_id = serializers.IntegerField(source='host.id', read_only=True)
    host_username = serializers.CharField(source='host.username', read_only=True)
    host_game_name = serializers.CharField(source='host.first_name', read_only=True)
    players = RoomPlayerSerializer(many=True, read_only=True)
    player_count = serializers.IntegerField(source='players.count', read_only=True)
    game_session = GameSessionSerializer(read_only=True)
    
    class Meta:
        model = Room
        fields = ('id', 'name', 'host_id', 'host_username', 'host_game_name', 
                  'created_at', 'is_active', 'players', 'player_count', 'game_session')


class CreateRoomSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=100, required=False, default='Panstwa Miasto Room')
    
    class Meta:
        model = Room
        fields = ('name',)
    
    def create(self, validated_data):
        from ..models import GameSession
        
        user = self.context['request'].user
        room = Room.objects.create(
            host=user,
            name=validated_data.get('name', 'Panstwa Miasto Room')
        )
        # Add host as a player
        RoomPlayer.objects.create(room=room, user=user)
        # Create default game session
        GameSession.objects.create(room=room, is_random_letter=True, selected_types=[])
        return room


class JoinRoomSerializer(serializers.Serializer):
    room_id = serializers.UUIDField()
    
    def validate_room_id(self, value):
        try:
            room = Room.objects.get(id=value, is_active=True)
        except Room.DoesNotExist:
            raise serializers.ValidationError("Room not found or inactive.")
        return value
    
    def create(self, validated_data):
        room = Room.objects.get(id=validated_data['room_id'])
        user = self.context['request'].user
        
        # Check if user is already in the room
        if RoomPlayer.objects.filter(room=room, user=user).exists():
            raise serializers.ValidationError("You are already in this room.")
        
        room_player = RoomPlayer.objects.create(room=room, user=user)
        return room_player
