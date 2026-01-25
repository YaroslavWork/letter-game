from rest_framework import serializers
from ..models import GameSession, GAME_TYPE_CHOICES


class GameSessionSerializer(serializers.ModelSerializer):
    selected_types_display = serializers.SerializerMethodField()
    final_letter = serializers.SerializerMethodField()
    
    class Meta:
        model = GameSession
        fields = ('id', 'letter', 'is_random_letter', 'selected_types', 
                  'selected_types_display', 'final_letter', 'total_rounds', 
                  'current_round', 'is_completed', 'round_letters', 'round_advance_scheduled', 
                  'round_timer_seconds', 'reduce_timer_on_complete_seconds', 'round_start_time', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at', 'round_start_time')
    
    def get_selected_types_display(self, obj):
        """Returns list of display names for selected types."""
        return obj.get_selected_types_display()
    
    def get_final_letter(self, obj):
        """
        Returns the final letter to use (or None if random and not yet determined).
        For random letters, returns None to prevent the letter from changing on every update.
        """
        final_letter = obj.get_final_letter()
        # If it's a random letter and None is returned, that's expected
        # The frontend will show "Random" message
        return final_letter
    
    def validate_letter(self, value):
        """Validate that letter is a single uppercase letter."""
        if value:
            value = value.upper().strip()
            if len(value) != 1 or not value.isalpha():
                raise serializers.ValidationError("Letter must be a single alphabetic character.")
            # Polish alphabet validation (excluding Q, V, X)
            if value in ['Q', 'V', 'X']:
                raise serializers.ValidationError("Letter Q, V, and X are not commonly used in Polish. Please choose another letter.")
        return value
    
    def validate_selected_types(self, value):
        """Validate that selected types are valid choices."""
        valid_types = [choice[0] for choice in GAME_TYPE_CHOICES]
        if not isinstance(value, list):
            raise serializers.ValidationError("Selected types must be a list.")
        if not value:
            raise serializers.ValidationError("At least one game type must be selected.")
        for type_key in value:
            if type_key not in valid_types:
                raise serializers.ValidationError(f"Invalid game type: {type_key}")
        return value


class UpdateGameSessionSerializer(serializers.ModelSerializer):
    """Serializer for updating game session rules."""
    
    class Meta:
        model = GameSession
        fields = ('letter', 'is_random_letter', 'selected_types', 'total_rounds', 'round_timer_seconds', 'reduce_timer_on_complete_seconds')
    
    def validate_letter(self, value):
        """Validate that letter is a single uppercase letter."""
        if value:
            value = value.upper().strip()
            if len(value) != 1 or not value.isalpha():
                raise serializers.ValidationError("Letter must be a single alphabetic character.")
            # Polish alphabet validation (excluding Q, V, X)
            if value in ['Q', 'V', 'X']:
                raise serializers.ValidationError("Letter Q, V, and X are not commonly used in Polish. Please choose another letter.")
        return value
    
    def validate_selected_types(self, value):
        """Validate that selected types are valid choices."""
        valid_types = [choice[0] for choice in GAME_TYPE_CHOICES]
        if not isinstance(value, list):
            raise serializers.ValidationError("Selected types must be a list.")
        if not value:
            raise serializers.ValidationError("At least one game type must be selected.")
        for type_key in value:
            if type_key not in valid_types:
                raise serializers.ValidationError(f"Invalid game type: {type_key}")
        return value
    
    def validate_round_timer_seconds(self, value):
        """Validate that timer duration is between 10 and 600 seconds."""
        if value < 10:
            raise serializers.ValidationError("Timer duration must be at least 10 seconds.")
        if value > 600:
            raise serializers.ValidationError("Timer duration must be at most 600 seconds (10 minutes).")
        return value
    
    def validate_reduce_timer_on_complete_seconds(self, value):
        """Validate that reduce timer seconds is between 5 and 300 seconds."""
        if value < 5:
            raise serializers.ValidationError("Reduce timer duration must be at least 5 seconds.")
        if value > 300:
            raise serializers.ValidationError("Reduce timer duration must be at most 300 seconds (5 minutes).")
        return value