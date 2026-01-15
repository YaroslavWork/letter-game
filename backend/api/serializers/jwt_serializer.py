from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom serializer to include user data in the JWT token response.
    Supports login with either username or email.
    """
    username_field = 'username'  # Default field name
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        return token

    def validate(self, attrs):
        username_or_email = attrs.get('username')
        password = attrs.get('password')
        
        if not username_or_email or not password:
            raise serializers.ValidationError(
                "Must include 'username' and 'password'."
            )
        
        try:
            user = User.objects.get(username=username_or_email)
        except User.DoesNotExist:
            try:
                user = User.objects.get(email=username_or_email)
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    "No active account found with the given credentials."
                )
        
        if not user.check_password(password):
            raise serializers.ValidationError(
                "No active account found with the given credentials."
            )
        
        if not user.is_active:
            raise serializers.ValidationError(
                "User account is disabled."
            )
        
        attrs['username'] = user.username
        
        data = super().validate(attrs)
        
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'game_name': self.user.first_name,
        }
        
        return data
