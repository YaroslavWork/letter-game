from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView, # The login view
    TokenRefreshView,  # The view to refresh an access token
)

from .views.register_view import RegisterView


urlpatterns = [    
    # Registration endpoint
    path('register/', RegisterView.as_view(), name='register'),
    # Login endpoint (obtains access and refresh tokens)
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    # Refresh token endpoint (gets a new access token)
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]