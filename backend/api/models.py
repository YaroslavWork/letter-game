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
    name = models.CharField(max_length=100, default='Panstwa Miasto Room')
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        letter_display = self.letter if self.letter else ("Random" if self.is_random_letter else "Not set")
        return f"Game Session for {self.room.name} - Letter: {letter_display}"
    
    def get_final_letter(self):
        """
        Returns the final letter to use. If is_random_letter is True and letter is None,
        generates a random Polish letter.
        """
        if not self.is_random_letter and self.letter:
            return self.letter.upper()
        elif self.is_random_letter:
            # Polish alphabet letters (excluding Q, V, X which are less common)
            polish_letters = [c for c in string.ascii_uppercase if c not in ['Q', 'V', 'X']]
            return random.choice(polish_letters)
        return None
    
    def get_selected_types_display(self):
        """
        Returns list of display names for selected types.
        """
        type_dict = dict(GAME_TYPE_CHOICES)
        return [type_dict.get(t, t) for t in self.selected_types]
