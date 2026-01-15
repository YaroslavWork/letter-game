import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings
from .models import Room, RoomPlayer
from .serializers.room_serializer import RoomSerializer, RoomPlayerSerializer


class RoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'room_{self.room_id}'
        
        # Get user from token
        try:
            user = await self.get_user_from_token()
            if not user:
                await self.close()
                return
            self.user = user
        except Exception as e:
            await self.close()
            return
        
        # Check if room exists and user has access
        room = await self.get_room()
        if not room:
            await self.close()
            return
        
        # Check if user is in the room
        is_in_room = await self.is_user_in_room(room, user)
        if not is_in_room:
            await self.close()
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send current room state
        await self.send_room_update()
    
    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'player_joined':
                await self.handle_player_joined()
            elif message_type == 'player_left':
                await self.handle_player_left()
            elif message_type == 'player_removed':
                await self.handle_player_removed(data.get('player_id'))
        except json.JSONDecodeError:
            pass
    
    async def handle_player_joined(self):
        await self.send_room_update()
    
    async def handle_player_left(self):
        await self.send_room_update()
    
    async def handle_player_removed(self, player_id):
        await self.send_room_update()
    
    async def room_update(self, event):
        """Send room update to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'room_update',
            'data': event['data']
        }))
    
    async def send_room_update(self):
        """Send current room state to all clients"""
        room = await self.get_room()
        if room:
            room_data = await self.serialize_room(room)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'room_update',
                    'data': room_data
                }
            )
    
    @database_sync_to_async
    def get_user_from_token(self):
        """Extract user from JWT token in query string"""
        query_string = self.scope.get('query_string', b'').decode()
        token = None
        
        # Parse query string to get token
        for param in query_string.split('&'):
            if 'token=' in param:
                token = param.split('token=')[1]
                break
        
        if not token:
            return None
        
        try:
            UntypedToken(token)
            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = decoded_data.get('user_id')
            return User.objects.get(id=user_id)
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None
    
    @database_sync_to_async
    def get_room(self):
        """Get room by ID"""
        try:
            return Room.objects.get(id=self.room_id, is_active=True)
        except Room.DoesNotExist:
            return None
    
    @database_sync_to_async
    def is_user_in_room(self, room, user):
        """Check if user is in the room"""
        return RoomPlayer.objects.filter(room=room, user=user).exists()
    
    @database_sync_to_async
    def serialize_room(self, room):
        """Serialize room data"""
        serializer = RoomSerializer(room)
        return serializer.data
