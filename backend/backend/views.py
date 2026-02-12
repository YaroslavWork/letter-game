"""
Serve React SPA build when running in Docker (unified backend + frontend).
Used only when frontend_build exists (e.g. after Docker build).
"""
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views.static import serve


def _frontend_build_dir():
    return Path(settings.BASE_DIR) / "frontend_build"


def serve_spa(request, path):
    """
    Serve static assets from frontend_build, or index.html for SPA routes.
    """
    build_dir = _frontend_build_dir()
    if not build_dir.is_dir():
        raise Http404("Frontend build not found. Run via Docker or npm start in frontend.")

    path = (path or "").strip().lstrip("/")

    # Serve /static/* from frontend_build/static
    if path.startswith("static/"):
        doc_root = build_dir
        rel_path = path
        full_path = (build_dir / rel_path).resolve()
        if not str(full_path).startswith(str(build_dir.resolve())):
            raise Http404()
        if not full_path.is_file():
            raise Http404()
        return serve(request, rel_path, document_root=str(doc_root))

    # Serve root-level assets (favicon, manifest, etc.)
    if path and not path.startswith("api") and not path.startswith("admin"):
        candidate = (build_dir / path).resolve()
        if str(candidate).startswith(str(build_dir.resolve())) and candidate.is_file():
            return serve(request, path, document_root=str(build_dir))

    # SPA fallback: index.html
    index = build_dir / "index.html"
    if not index.is_file():
        raise Http404("index.html not found.")
    return FileResponse(index.open("rb"), content_type="text/html")
