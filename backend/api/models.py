from django.db import models
from django.contrib.auth.models import User
import uuid
import random
import string


# Game type choices
GAME_TYPE_CHOICES = [
    ('panstwo', 'Państwo'),
    ('miasto', 'Miasto'),
    ('imie', 'Imię'),
    ('zwierze', 'Zwierzę'),
    ('rzecz', 'Rzecz'),
    ('roslina', 'Roślina'),
    ('kolor', 'Kolor'),
    ('owoc_warzywo', 'Owoc lub Warzywo'),
    ('marka_samochodu', 'Marka samochodu'),
    ('czesc_ciala', 'Część ciała'),
    ('celebryta', 'Celebryta'),
    ('slowo_powyzej_8', 'Słowo powyżej 8 liter'),
    ('slowo_ponizej_5', 'Słowo poniżej 5 liter'),
]


class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_rooms')
    name = models.CharField(max_length=100, default='Letter Game Room')
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} (Host: {self.host.username})"


class RoomPlayer(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='players')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='room_participations')
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['room', 'user']
        ordering = ['joined_at']
    
    def __str__(self):
        return f"{self.user.username} in {self.room.name}"


class GameSession(models.Model):
    """
    Game session model to store game rules (letter and selected types) for a room.
    """
    room = models.OneToOneField(Room, on_delete=models.CASCADE, related_name='game_session')
    letter = models.CharField(max_length=1, null=True, blank=True, help_text="Selected letter for the game. Null means random.")
    is_random_letter = models.BooleanField(default=True, help_text="If True, letter will be randomly selected when game starts.")
    selected_types = models.JSONField(default=list, help_text="List of selected game types (keys from GAME_TYPE_CHOICES)")
    total_rounds = models.IntegerField(default=1, help_text="Total number of rounds to play")
    current_round = models.IntegerField(default=1, help_text="Current round number")
    is_completed = models.BooleanField(default=False, help_text="Whether all rounds are completed")
    round_letters = models.JSONField(default=list, help_text="List of letters used for each round")
    round_advance_scheduled = models.BooleanField(default=False, help_text="Whether round advancement is already scheduled")
    round_timer_seconds = models.IntegerField(default=60, help_text="Timer duration in seconds for each round")
    round_start_time = models.DateTimeField(null=True, blank=True, help_text="Timestamp when the current round started")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        letter_display = self.letter if self.letter else ("Random" if self.is_random_letter else "Not set")
        return f"Game Session for {self.room.name} - Letter: {letter_display}"
    
    def get_final_letter(self):
        """
        Returns the final letter to use. 
        - If a letter is set (whether random or not), returns that letter.
        - If is_random_letter is True and letter is None, returns None (letter will be determined when game starts).
        - This prevents generating a new random letter on every serialization.
        """
        if self.letter:
            return self.letter.upper()
        # For random letters that haven't been set yet, return None
        # The letter will be determined when the game starts
        return None
    
    def get_selected_types_display(self):
        """
        Returns list of display names for selected types.
        """
        type_dict = dict(GAME_TYPE_CHOICES)
        return [type_dict.get(t, t) for t in self.selected_types]


class PlayerAnswer(models.Model):
    """
    Model to store player answers for a game session round.
    """
    game_session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name='player_answers')
    player = models.ForeignKey(RoomPlayer, on_delete=models.CASCADE, related_name='answers')
    round_number = models.IntegerField(default=1, help_text="Round number this answer belongs to")
    answers = models.JSONField(default=dict, help_text="Dictionary mapping game type keys to player's answers")
    points = models.IntegerField(default=0, help_text="Total points earned in this round")
    points_per_category = models.JSONField(default=dict, help_text="Dictionary mapping game type keys to points earned per category")
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['game_session', 'player', 'round_number']
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"{self.player.user.username} - {self.points} points"
