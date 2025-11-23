class FluxionDBError(Exception):
    """Base class for FluxionDB client errors."""


class FluxionDBConnectionError(FluxionDBError):
    """Raised when a WebSocket connection cannot be established."""


class FluxionDBTimeoutError(FluxionDBError):
    """Raised when a request does not receive a response in time."""
