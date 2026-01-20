from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .serializers.room_serializer import RoomSerializer


def broadcast_room_update(room, removed_user_id=None):
    """
    Broadcast room update to all WebSocket clients in the room.
    
    Args:
        room: The room object to broadcast
        removed_user_id: Optional user ID of the player who was removed (for notification)
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        room_serializer = RoomSerializer(room)
        room_data = room_serializer.data
        
        # Send room update
        async_to_sync(channel_layer.group_send)(
            f'room_{room.id}',
            {
                'type': 'room_update',
                'data': room_data
            }
        )
        
        # If a player was removed, send a special notification
        if removed_user_id:
            async_to_sync(channel_layer.group_send)(
                f'room_{room.id}',
                {
                    'type': 'player_removed_notification',
                    'removed_user_id': removed_user_id
                }
            )


def broadcast_room_deleted(room_id):
    """
    Broadcast room deletion to all WebSocket clients in the room.
    
    Args:
        room_id: The room ID (as string) that was deleted
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        # Send room deleted notification to all clients in the room
        async_to_sync(channel_layer.group_send)(
            f'room_{room_id}',
            {
                'type': 'room_deleted_notification',
                'room_id': room_id
            }
        )


def broadcast_game_started(room, game_session):
    """
    Broadcast game started notification to all WebSocket clients in the room.
    
    Args:
        room: The room object
        game_session: The game session object with the final letter
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        from .serializers.game_session_serializer import GameSessionSerializer
        game_serializer = GameSessionSerializer(game_session)
        game_data = game_serializer.data
        
        # Send game started notification to all clients in the room
        async_to_sync(channel_layer.group_send)(
            f'room_{room.id}',
            {
                'type': 'game_started_notification',
                'room_id': str(room.id),
                'game_session': game_data
            }
        )
