from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Match UUID pattern (case-insensitive)
    re_path(r'^ws/room/(?P<room_id>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/$', consumers.RoomConsumer.as_asgi()),
]
