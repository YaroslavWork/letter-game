from rest_framework import serializers
from ..models import PlayerAnswer, GameSession, RoomPlayer


class PlayerAnswerSerializer(serializers.ModelSerializer):
    player_username = serializers.CharField(source='player.user.username', read_only=True)
    player_game_name = serializers.CharField(source='player.user.first_name', read_only=True)
    points = serializers.SerializerMethodField()
    points_per_category = serializers.SerializerMethodField()
    
    class Meta:
        model = PlayerAnswer
        fields = ('id', 'player', 'player_username', 'player_game_name', 'answers', 'points', 'points_per_category', 'submitted_at')
        read_only_fields = ('id', 'points', 'points_per_category', 'submitted_at')
    
    def get_points(self, obj):
        """Only return points if all players have submitted"""
        game_session = obj.game_session
        room_players = game_session.room.players.all()
        all_player_answers = PlayerAnswer.objects.filter(game_session=game_session)
        
        # Check if all players have submitted
        if all_player_answers.count() >= room_players.count():
            return obj.points
        return None  # Hide points until all players submit
    
    def get_points_per_category(self, obj):
        """Only return points_per_category if all players have submitted"""
        game_session = obj.game_session
        room_players = game_session.room.players.all()
        all_player_answers = PlayerAnswer.objects.filter(game_session=game_session)
        
        # Check if all players have submitted
        if all_player_answers.count() >= room_players.count():
            return obj.points_per_category
        return {}  # Hide points until all players submit


class SubmitAnswerSerializer(serializers.Serializer):
    answers = serializers.DictField(
        child=serializers.CharField(allow_blank=True),
        help_text="Dictionary mapping game type keys to player's answers"
    )
    
    def validate_answers(self, value):
        if not value:
            raise serializers.ValidationError("Answers cannot be empty.")
        return value
