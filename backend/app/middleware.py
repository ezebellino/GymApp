import time
import logging
from typing import Callable
from fastapi import Request
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from .config import settings

logger = logging.getLogger("request")

class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        start_ns = time.perf_counter_ns()
        method, path = request.method, request.url.path
        client = request.client.host if request.client else "unknown"

        user_label = "Anonymous"
        auth_header = request.headers.get("Authorization")
        logger.debug("[dbg] Auth header for %s %s: %r", method, path, auth_header)

        if auth_header:
            parts = auth_header.strip().split(None, 1)
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1].strip()
                try:
                    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                    user_label = payload.get("name") or payload.get("email") or payload.get("sub", "UnknownUser")
                except JWTError as e:
                    logger.debug("[dbg] JWT decode failed on %s: %r", path, e)

        response = await call_next(request)
        dur_ms = (time.perf_counter_ns() - start_ns) / 1_000_000
        logger.info("[%s] %s %s -> %d in %.2fms from %s", user_label, method, path, response.status_code, dur_ms, client)
        return response
