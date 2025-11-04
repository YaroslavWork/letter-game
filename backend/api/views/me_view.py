from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

# Make sure you import your UserSerializer
from ..serializers.user_serializer import UserSerializer 

class MeView(APIView):
    """
    API view to retrieve the currently authenticated user's data.
    """
    
    # Permissions are set the same way
    permission_classes = (IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        """
        Handles the GET request for the /me endpoint.
        """
        
        # 1. Get the user from the request
        user = request.user
        
        # 2. Manually serialize the user data
        serializer = UserSerializer(user)
        
        # 3. Return the serialized data in a Response object
        return Response(serializer.data, status=status.HTTP_200_OK)