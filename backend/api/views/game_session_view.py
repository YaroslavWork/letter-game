from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
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
        
        # If random letter, generate one now
        if game_session.is_random_letter and not game_session.letter:
            # Generate a random letter (excluding rarely used letters like Q, X, Y, Z)
            # Using common Polish alphabet letters
            common_letters = list(string.ascii_uppercase)
            # Remove some rare letters for better game experience
            rare_letters = ['Q', 'X', 'Y']
            for letter in rare_letters:
                if letter in common_letters:
                    common_letters.remove(letter)
            
            game_session.letter = random.choice(common_letters)
            game_session.save()
        
        # If not random but no letter set, return error
        if not game_session.is_random_letter and not game_session.letter:
            return Response(
                {'error': 'Please set a letter or enable random letter before starting the game.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Broadcast game started message to all players
        broadcast_game_started(room, game_session)
        
        # Return full game session data
        serializer = GameSessionSerializer(game_session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SubmitAnswerView(APIView):
    """
    API view for players to submit their answers and calculate points.
    Points are calculated based on:
    - Unique answers: 10 points
    - Duplicate answers: 5 points
    - Empty answers: 0 points
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
        
        # Validate answers start with the correct letter
        validated_answers = {}
        for game_type, answer in answers.items():
            if game_type not in game_session.selected_types:
                continue
            answer_clean = answer.strip()
            if answer_clean:
                if answer_clean[0].upper() == letter:
                    validated_answers[game_type] = answer_clean
                else:
                    validated_answers[game_type] = ""
            else:
                validated_answers[game_type] = ""
        
        # Get all existing answers from other players in this game session
        existing_answers = PlayerAnswer.objects.filter(
            game_session=game_session
        ).exclude(player=room_player)
        
        # Calculate points
        points = 0
        all_answers_by_type = {}
        
        for existing_answer_obj in existing_answers:
            for game_type, answer in existing_answer_obj.answers.items():
                if game_type not in all_answers_by_type:
                    all_answers_by_type[game_type] = []
                if answer:
                    all_answers_by_type[game_type].append(answer.lower())
        
        for game_type, answer in validated_answers.items():
            if not answer:
                continue
            
            answer_lower = answer.lower()
            matching_answers = [a for a in all_answers_by_type.get(game_type, []) if a == answer_lower]
            
            if len(matching_answers) == 0:
                points += 10
            else:
                points += 5
        
        # Create or update player answer
        player_answer, created = PlayerAnswer.objects.update_or_create(
            game_session=game_session,
            player=room_player,
            defaults={
                'answers': validated_answers,
                'points': points
            }
        )
        
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
        player_answers = PlayerAnswer.objects.filter(game_session=game_session)
        
        serializer = PlayerAnswerSerializer(player_answers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
