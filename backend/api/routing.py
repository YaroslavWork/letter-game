from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Match UUID pattern (case-insensitive)
    # Django Channels matches the path without leading slash
    # Pattern matches: ws/room/<uuid>/ or ws/room/<uuid>
    # Query strings (?token=...) are handled separately via scope['query_string']
    re_path(r'^ws/room/(?P<room_id>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/?$', consumers.RoomConsumer.as_asgi()),
]
