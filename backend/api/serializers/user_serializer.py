from django.contrib.auth.models import User
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model.
    Used for reading user data (no password).
    """
    class Meta:
        model = User
        # List only the fields you want to return
        fields = ('id', 'username', 'email', 'first_name', 'last_name')