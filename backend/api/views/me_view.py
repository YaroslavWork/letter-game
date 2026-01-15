from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..serializers.user_serializer import UserSerializer 

class MeView(APIView):
    """
    API view to retrieve the currently authenticated user's data.
    """
    
    permission_classes = (IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        """
        Handles the GET request for the /me endpoint.
        """
        user = request.user
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)