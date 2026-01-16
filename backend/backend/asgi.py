"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django_asgi_app = get_asgi_application()

from api import routing

# In development, allow all origins for WebSocket connections
# In production, use AllowedHostsOriginValidator
if settings.DEBUG:
    websocket_application = AuthMiddlewareStack(
        URLRouter(routing.websocket_urlpatterns)
    )
else:
    websocket_application = AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(routing.websocket_urlpatterns)
        )
    )

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": websocket_application,
})
