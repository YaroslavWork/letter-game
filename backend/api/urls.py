from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views.register_view import RegisterView
from .views.me_view import MeView
from .views.login_view import CustomTokenObtainPairView
from .views.room_view import (
    CreateRoomView, JoinRoomView, LeaveRoomView, 
    RoomDetailView, DeletePlayerView, DeleteRoomView
)
from .views.game_session_view import (
    GetGameTypesView, GetGameSessionView, UpdateGameSessionView, StartGameSessionView
)


urlpatterns = [    
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('rooms/create/', CreateRoomView.as_view(), name='create_room'),
    path('rooms/join/', JoinRoomView.as_view(), name='join_room'),
    path('rooms/<uuid:room_id>/', RoomDetailView.as_view(), name='room_detail'),
    path('rooms/<uuid:room_id>/leave/', LeaveRoomView.as_view(), name='leave_room'),
    path('rooms/<uuid:room_id>/delete/', DeleteRoomView.as_view(), name='delete_room'),
    path('rooms/<uuid:room_id>/players/<int:player_id>/delete/', DeletePlayerView.as_view(), name='delete_player'),
    path('game-types/', GetGameTypesView.as_view(), name='get_game_types'),
    path('rooms/<uuid:room_id>/game-session/', GetGameSessionView.as_view(), name='get_game_session'),
    path('rooms/<uuid:room_id>/game-session/update/', UpdateGameSessionView.as_view(), name='update_game_session'),
    path('rooms/<uuid:room_id>/game-session/start/', StartGameSessionView.as_view(), name='start_game_session'),
]