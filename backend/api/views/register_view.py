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

    def get(self, request):
        return Response({"info": "Welcome to the register page"}, status=status.HTTP_200_OK)

    def post(self, request):
        """
        Handles POST request to create a new user.
        """
        # 1. Instantiate the serializer with the incoming request data
        serializer = RegisterSerializer(data=request.data)

        # 2. Check if the data is valid
        if serializer.is_valid():
            # 3. Save the new user to the database
            serializer.save()
            
            # 4. Return a successful response
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # 5. If data is not valid, return the errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)