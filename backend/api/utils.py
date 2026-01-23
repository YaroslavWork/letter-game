from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import threading
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


def broadcast_player_submitted(room, player_username, all_players_submitted=False):
    """
    Broadcast notification when a player submits their answers.
    
    Args:
        room: The room object
        player_username: Username of the player who submitted
        all_players_submitted: Whether all players have now submitted
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f'room_{room.id}',
            {
                'type': 'player_submitted_notification',
                'player_username': player_username,
                'all_players_submitted': all_players_submitted
            }
        )


def advance_round_internal(room_id_str):
    """
    Internal function to advance round. Called from thread with proper Django setup.
    
    Args:
        room_id_str: Room ID as string
    """
    import os
    import django
    
    # Ensure Django is set up in this thread
    if not os.environ.get('DJANGO_SETTINGS_MODULE'):
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
        django.setup()
    
    from django.db import transaction, connection, close_old_connections
    from .models import Room, GameSession, RoomPlayer, PlayerAnswer
    import random
    import string
    
    print(f"advance_round_internal called for room {room_id_str}")
    
    try:
        # Close old connections and ensure fresh connection
        close_old_connections()
        
        with transaction.atomic():
            # Refresh room and game session from database
            room_obj = Room.objects.select_for_update().get(id=room_id_str, is_active=True)
            game_session = GameSession.objects.select_for_update().get(room=room_obj)
            
            # Check if game is still active and not completed
            if game_session.is_completed:
                close_old_connections()
                return
            
            # Check if all players have submitted
            room_players = RoomPlayer.objects.filter(room=room_obj)
            all_player_answers = PlayerAnswer.objects.filter(
                game_session=game_session,
                round_number=game_session.current_round
            )
            
            if all_player_answers.count() < room_players.count():
                # Not all players submitted, cancel advancement
                game_session.round_advance_scheduled = False
                game_session.save()
                close_old_connections()
                return
            
            # Advance to next round
            if game_session.current_round < game_session.total_rounds:
                old_round = game_session.current_round
                game_session.current_round += 1
                
                # Generate random letter for new round
                common_letters = list(string.ascii_uppercase)
                rare_letters = ['Q', 'X', 'Y']
                for letter in rare_letters:
                    if letter in common_letters:
                        common_letters.remove(letter)
                
                round_letter = random.choice(common_letters)
                game_session.letter = round_letter
                game_session.round_letters.append(round_letter)
                game_session.round_advance_scheduled = False
                game_session.save()
                
                # Broadcast room update to advance to next round
                print(f"Successfully advanced room {room_id_str} from round {old_round} to round {game_session.current_round} with letter {round_letter}")
                broadcast_room_update(room_obj)
            else:
                # Game completed
                print(f"Game completed for room {room_id_str}")
                game_session.is_completed = True
                game_session.round_advance_scheduled = False
                game_session.save()
                
                # Broadcast room update
                broadcast_room_update(room_obj)
                
        # Close connection after transaction
        close_old_connections()
    except Exception as e:
        # Log error but don't crash
        import traceback
        print(f"Error advancing round for room {room_id_str}: {e}")
        traceback.print_exc()
        close_old_connections()


# Store active timers to prevent garbage collection
_active_timers = {}

def schedule_round_advancement(room, delay_seconds=10):
    """
    Schedule automatic round advancement after delay.
    
    Args:
        room: The room object
        delay_seconds: Delay in seconds before advancing (default 10)
    """
    room_id_str = str(room.id)
    
    # Cancel any existing timer for this room
    if room_id_str in _active_timers:
        old_timer = _active_timers[room_id_str]
        old_timer.cancel()
    
    # Schedule the advancement
    print(f"Scheduling round advancement for room {room_id_str} in {delay_seconds} seconds")
    timer = threading.Timer(delay_seconds, advance_round_internal, args=(room_id_str,))
    timer.daemon = True  # Allow thread to exit when main program exits
    
    # Store timer to prevent garbage collection
    _active_timers[room_id_str] = timer
    
    timer.start()
    print(f"Round advancement timer started for room {room_id_str}")
    
    # Clean up timer reference after it executes
    def cleanup_timer():
        if room_id_str in _active_timers:
            del _active_timers[room_id_str]
    
    cleanup_timer_thread = threading.Timer(delay_seconds + 1, cleanup_timer)
    cleanup_timer_thread.daemon = True
    cleanup_timer_thread.start()
