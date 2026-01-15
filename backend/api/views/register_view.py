from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import User

from ..serializers.register_serializer import RegisterSerializer


class RegisterView(APIView):
    """
    API view for user registration.
    """
    
    permission_classes = (AllowAny,)

    def post(self, request):
        """
        Handles POST request to create a new user.
        """
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)