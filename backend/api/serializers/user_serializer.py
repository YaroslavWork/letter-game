from django.contrib.auth.models import User
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model.
    Used for reading user data (no password).
    """
    game_name = serializers.CharField(source='first_name', read_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'game_name')