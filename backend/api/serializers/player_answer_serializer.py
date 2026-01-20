from rest_framework import serializers
from ..models import PlayerAnswer, GameSession, RoomPlayer


class PlayerAnswerSerializer(serializers.ModelSerializer):
    player_username = serializers.CharField(source='player.user.username', read_only=True)
    player_game_name = serializers.CharField(source='player.user.first_name', read_only=True)
    
    class Meta:
        model = PlayerAnswer
        fields = ('id', 'player', 'player_username', 'player_game_name', 'answers', 'points', 'submitted_at')
        read_only_fields = ('id', 'points', 'submitted_at')


class SubmitAnswerSerializer(serializers.Serializer):
    answers = serializers.DictField(
        child=serializers.CharField(allow_blank=True),
        help_text="Dictionary mapping game type keys to player's answers"
    )
    
    def validate_answers(self, value):
        if not value:
            raise serializers.ValidationError("Answers cannot be empty.")
        return value
