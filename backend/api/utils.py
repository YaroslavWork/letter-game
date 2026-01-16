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
