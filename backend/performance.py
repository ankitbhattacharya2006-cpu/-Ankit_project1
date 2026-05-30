# Backend Performance Optimizations
# Add this to backend/main.py after imports

from functools import lru_cache
from fastapi.responses import ORJSONResponse
import time

# Use ORJSON for 3x faster JSON serialization
# Update app initialization to use ORJSONResponse as default

# Response Caching Decorator
_response_cache = {}
_cache_timestamps = {}
CACHE_TTL = 60  # 60 seconds

def cache_response(ttl_seconds=60):
    """Cache API responses for specified TTL"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            now = time.time()
            
            if cache_key in _response_cache:
                if now - _cache_timestamps[cache_key] < ttl_seconds:
                    return _response_cache[cache_key]
            
            result = await func(*args, **kwargs)
            _response_cache[cache_key] = result
            _cache_timestamps[cache_key] = now
            return result
        return wrapper
    return decorator

# Query Optimizations
class QueryOptimizer:
    @staticmethod
    def eager_load_relations(query):
        """Add joinedload for N+1 prevention"""
        from sqlalchemy.orm import joinedload
        return query.options(joinedload('*'))
    
    @staticmethod
    def paginate_efficiently(query, limit, offset):
        """Use LIMIT/OFFSET at DB level"""
        return query.limit(limit).offset(offset)

# Response Compression
from fastapi.middleware.gzip import GZIPMiddleware
def add_gzip(app):
    app.add_middleware(GZIPMiddleware, minimum_size=500)
