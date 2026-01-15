from rest_framework_simplejwt.views import TokenObtainPairView
from ..serializers.jwt_serializer import CustomTokenObtainPairSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom login view that uses CustomTokenObtainPairSerializer
    to include user data in the response.
    """
    serializer_class = CustomTokenObtainPairSerializer
