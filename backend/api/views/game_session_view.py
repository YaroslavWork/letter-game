from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
import random
import string
from ..models import Room, GameSession, RoomPlayer, PlayerAnswer, GAME_TYPE_CHOICES
from ..serializers.game_session_serializer import GameSessionSerializer, UpdateGameSessionSerializer
from ..serializers.player_answer_serializer import SubmitAnswerSerializer, PlayerAnswerSerializer
from ..utils import broadcast_room_update, broadcast_game_started


class GetGameTypesView(APIView):
    """
    API view to get all available game types.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        game_types = [{'key': choice[0], 'label': choice[1]} for choice in GAME_TYPE_CHOICES]
        return Response(game_types, status=status.HTTP_200_OK)


class GetGameSessionView(APIView):
    """
    API view to get game session for a room.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Check if user is in the room
        from ..models import RoomPlayer
        if not RoomPlayer.objects.filter(room=room, user=request.user).exists():
            return Response(
                {'error': 'You are not a member of this room.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session, created = GameSession.objects.get_or_create(room=room)
        serializer = GameSessionSerializer(game_session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UpdateGameSessionView(APIView):
    """
    API view for host to update game session rules (letter and types).
    """
    permission_classes = (IsAuthenticated,)
    
    def put(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Only host can update game session
        if room.host != request.user:
            return Response(
                {'error': 'Only the host can update game rules.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session, created = GameSession.objects.get_or_create(room=room)
        serializer = UpdateGameSessionSerializer(game_session, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            # Refresh room to get updated game session
            room.refresh_from_db()
            # Broadcast update to all clients
            broadcast_room_update(room)
            # Return full game session data
            full_serializer = GameSessionSerializer(game_session)
            return Response(full_serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StartGameSessionView(APIView):
    """
    API view for host to start the game session.
    Generates random letter if needed and broadcasts game_started to all players.
    """
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Only host can start the game
        if room.host != request.user:
            return Response(
                {'error': 'Only the host can start the game.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session, created = GameSession.objects.get_or_create(room=room)
        
        # Check if game types are configured
        if not game_session.selected_types or len(game_session.selected_types) == 0:
            return Response(
                {'error': 'Please configure game types before starting the game.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Reset game state for new game
        game_session.current_round = 1
        game_session.is_completed = False
        game_session.round_letters = []
        
        # Generate random letter for round 1
        # If rounds > 1, always use random letters
        if game_session.total_rounds > 1 or game_session.is_random_letter:
            # Generate a random letter (excluding rarely used letters like Q, X, Y, Z)
            # Using common Polish alphabet letters
            common_letters = list(string.ascii_uppercase)
            # Remove some rare letters for better game experience
            rare_letters = ['Q', 'X', 'Y']
            for letter in rare_letters:
                if letter in common_letters:
                    common_letters.remove(letter)
            
            round_letter = random.choice(common_letters)
            game_session.letter = round_letter
            game_session.round_letters = [round_letter]
            game_session.is_random_letter = True  # Force random when rounds > 1
        else:
            # Single round with specific letter
            if not game_session.letter:
                return Response(
                    {'error': 'Please set a letter or enable random letter before starting the game.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            game_session.round_letters = [game_session.letter]
        
        # Set round start time for timer
        game_session.round_start_time = timezone.now()
        
        game_session.save()
        
        # Broadcast game started message to all players
        broadcast_game_started(room, game_session)
        
        # Return full game session data
        serializer = GameSessionSerializer(game_session)
        return Response(serializer.data, status=status.HTTP_200_OK)


def recalculate_all_scores(game_session, round_number=None):
    """
    Recalculate all player scores based on the game rules:
    - If answer doesn't start with the letter: 0 points
    - If only one player answered a category: 15 points
    - If answer is unique (only one player has it): 10 points
    - If answer is repeating (multiple players have it): 5 points each
    """
    letter = game_session.letter.upper()
    if round_number is None:
        round_number = game_session.current_round
    all_player_answers = PlayerAnswer.objects.filter(
        game_session=game_session,
        round_number=round_number
    )
    
    # Get all players in the room
    room_players = RoomPlayer.objects.filter(room=game_session.room)
    total_players = room_players.count()
    
    # If not all players have submitted, don't recalculate yet
    if all_player_answers.count() < total_players:
        return
    
    # Organize answers by game type
    answers_by_type = {}
    for player_answer in all_player_answers:
        for game_type, answer in player_answer.answers.items():
            if game_type not in answers_by_type:
                answers_by_type[game_type] = []
            
            # Clean and validate answer
            if not answer or not isinstance(answer, str):
                continue
            answer_clean = answer.strip()
            # Check if answer starts with the correct letter
            if answer_clean and answer_clean[0].upper() == letter:
                answers_by_type[game_type].append({
                    'player_answer': player_answer,
                    'answer': answer_clean.lower()
                })
    
    # Calculate points for each player and per category
    player_points = {}
    player_points_per_category = {}
    for player_answer in all_player_answers:
        player_points[player_answer] = 0
        player_points_per_category[player_answer] = {}
    
    # Score each category
    for game_type, answer_list in answers_by_type.items():
        if len(answer_list) == 0:
            # No valid answers for this category - all players get 0 points
            for player_answer in all_player_answers:
                player_points_per_category[player_answer][game_type] = 0
            continue
        elif len(answer_list) == 1:
            # Only one player answered this category: 15 points
            player_answer = answer_list[0]['player_answer']
            player_points[player_answer] += 15
            player_points_per_category[player_answer][game_type] = 15
            # Other players get 0 for this category
            for pa in all_player_answers:
                if pa != player_answer:
                    player_points_per_category[pa][game_type] = 0
        else:
            # Multiple players answered, check for duplicates
            answer_counts = {}
            for item in answer_list:
                answer_lower = item['answer']
                if answer_lower not in answer_counts:
                    answer_counts[answer_lower] = []
                answer_counts[answer_lower].append(item['player_answer'])
            
            # Initialize all players with 0 for this category
            for player_answer in all_player_answers:
                player_points_per_category[player_answer][game_type] = 0
            
            # Score based on uniqueness
            for answer_lower, players_with_answer in answer_counts.items():
                if len(players_with_answer) == 1:
                    # Unique answer: 10 points
                    player_answer = players_with_answer[0]
                    player_points[player_answer] += 10
                    player_points_per_category[player_answer][game_type] = 10
                else:
                    # Repeating answer: 5 points each
                    for player_answer in players_with_answer:
                        player_points[player_answer] += 5
                        player_points_per_category[player_answer][game_type] = 5
    
    # Update all player answers with recalculated points
    for player_answer in all_player_answers:
        player_answer.points = player_points[player_answer]
        player_answer.points_per_category = player_points_per_category[player_answer]
        player_answer.save()


class SubmitAnswerView(APIView):
    """
    API view for players to submit their answers.
    Scores are recalculated for all players after all players submit.
    Scoring rules:
    - If answer doesn't start with the letter: 0 points
    - If only one player answered a category: 15 points
    - If answer is unique (only one player has it): 10 points
    - If answer is repeating (multiple players have it): 5 points each
    """
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Check if user is in the room
        try:
            room_player = RoomPlayer.objects.get(room=room, user=request.user)
        except RoomPlayer.DoesNotExist:
            return Response(
                {'error': 'You are not a member of this room.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session = get_object_or_404(GameSession, room=room)
        
        # Validate that game has started (letter is set)
        if not game_session.letter:
            return Response(
                {'error': 'Game has not started yet.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = SubmitAnswerSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        answers = serializer.validated_data['answers']
        letter = game_session.letter.upper()
        
        # Validate and clean answers
        validated_answers = {}
        for game_type, answer in answers.items():
            if game_type not in game_session.selected_types:
                continue
            # Clean answer (handle None, empty strings, and non-strings)
            if not answer or not isinstance(answer, str):
                answer_clean = ""
            else:
                answer_clean = answer.strip()
            # Store the answer as-is (we'll validate letter match during scoring)
            validated_answers[game_type] = answer_clean
        
        # Create or update player answer for current round (initially with 0 points)
        player_answer, created = PlayerAnswer.objects.update_or_create(
            game_session=game_session,
            player=room_player,
            round_number=game_session.current_round,
            defaults={
                'answers': validated_answers,
                'points': 0  # Will be recalculated
            }
        )
        
        # Check if all players have submitted for current round
        room_players = RoomPlayer.objects.filter(room=room)
        all_player_answers = PlayerAnswer.objects.filter(
            game_session=game_session,
            round_number=game_session.current_round
        )
        all_players_submitted = all_player_answers.count() >= room_players.count()
        
        # Recalculate all scores for current round (this will only update if all players have submitted)
        recalculate_all_scores(game_session, game_session.current_round)
        
        # Refresh player_answer to get updated points
        player_answer.refresh_from_db()
        
        # Broadcast player submission notification
        from ..utils import broadcast_player_submitted
        broadcast_player_submitted(room, room_player.user.username, all_players_submitted)
        
        # Broadcast room update to show scores
        broadcast_room_update(room)
        
        response_serializer = PlayerAnswerSerializer(player_answer)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class GetPlayerScoresView(APIView):
    """
    API view to get all player scores for a game session.
    """
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Check if user is in the room
        if not RoomPlayer.objects.filter(room=room, user=request.user).exists():
            return Response(
                {'error': 'You are not a member of this room.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session = get_object_or_404(GameSession, room=room)
        
        # Check if requesting total scores (for completed games)
        include_totals = request.query_params.get('include_totals', 'false').lower() == 'true'
        
        # Get answers for current round
        player_answers = PlayerAnswer.objects.filter(
            game_session=game_session,
            round_number=game_session.current_round
        )
        
        serializer = PlayerAnswerSerializer(player_answers, many=True)
        response_data = serializer.data
        
        # If game is completed, include total scores across all rounds
        if include_totals or game_session.is_completed:
            room_players = RoomPlayer.objects.filter(room=room)
            total_scores = {}
            
            for room_player in room_players:
                total_points = 0
                all_round_answers = PlayerAnswer.objects.filter(
                    game_session=game_session,
                    player=room_player
                )
                for answer in all_round_answers:
                    total_points += answer.points or 0
                total_scores[room_player.id] = total_points
            
            response_data = {
                'round_scores': serializer.data,
                'total_scores': total_scores,
                'game_completed': game_session.is_completed
            }
        
        return Response(response_data, status=status.HTTP_200_OK)


class AdvanceRoundView(APIView):
    """
    API view to advance to the next round after all players have submitted.
    Generates a new random letter for the next round.
    """
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, is_active=True)
        
        # Only host can advance rounds
        if room.host != request.user:
            return Response(
                {'error': 'Only the host can advance rounds.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        game_session = get_object_or_404(GameSession, room=room)
        
        # Check if game is completed
        if game_session.is_completed:
            return Response(
                {'error': 'Game is already completed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if all players have submitted for current round
        room_players = RoomPlayer.objects.filter(room=room)
        all_player_answers = PlayerAnswer.objects.filter(
            game_session=game_session,
            round_number=game_session.current_round
        )
        
        if all_player_answers.count() < room_players.count():
            return Response(
                {'error': 'Not all players have submitted their answers for this round.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Reset round_advance_scheduled flag
        game_session.round_advance_scheduled = False
        
        # Advance to next round
        if game_session.current_round < game_session.total_rounds:
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
            # Set round start time for timer
            game_session.round_start_time = timezone.now()
            game_session.save()
            
            # Broadcast room update
            broadcast_room_update(room)
            
            serializer = GameSessionSerializer(game_session)
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            # Game completed
            game_session.is_completed = True
            game_session.save()
            
            # Broadcast room update
            broadcast_room_update(room)
            
            serializer = GameSessionSerializer(game_session)
            return Response(serializer.data, status=status.HTTP_200_OK)
