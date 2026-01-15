from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .serializers.room_serializer import RoomSerializer


def broadcast_room_update(room):
    """
    Broadcast room update to all WebSocket clients in the room.
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        room_serializer = RoomSerializer(room)
        room_data = room_serializer.data
        
        async_to_sync(channel_layer.group_send)(
            f'room_{room.id}',
            {
                'type': 'room_update',
                'data': room_data
            }
        )
