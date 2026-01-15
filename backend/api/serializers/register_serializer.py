from django.contrib.auth.models import User
from rest_framework import serializers, validators
from django.core.validators import EmailValidator

class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        allow_blank=False,
        validators=[
            EmailValidator(message="Enter a valid email address."),
            validators.UniqueValidator(
                queryset=User.objects.all(),
                message="A user with that email already exists."
            )
        ]
    )
    
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'},
        help_text="Password must be at least 8 characters long."
    )
    
    game_name = serializers.CharField(
        source='first_name',
        required=False,
        allow_blank=True,
        help_text="Your game name/profile name."
    )
    
    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'game_name')

        extra_kwargs = {
            "username": {
                "required": True,
                "allow_blank": False,
            },
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=''
        )
        return user