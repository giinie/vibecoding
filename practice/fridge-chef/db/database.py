"""SQLite database connection and session management.

Performance optimizations:
- Connection pooling with QueuePool
- WAL mode for better concurrency
- Optimized SQLite pragmas
- Singleton engine pattern
"""
import os
from contextlib import contextmanager
from pathlib import Path
from threading import Lock

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool

# Database file path
DB_PATH = Path(__file__).parent.parent / "fridge_chef.db"
DEFAULT_DATABASE_URL = f"sqlite:///{DB_PATH}"

# Thread-safe singleton for engine
_engine_lock = Lock()
_engine = None

# Session factory with optimized settings
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,  # Don't expire objects after commit for reuse
)


def _configure_sqlite_pragmas(dbapi_connection, connection_record):
    """Configure SQLite pragmas for better performance."""
    cursor = dbapi_connection.cursor()
    # WAL mode for better concurrency
    cursor.execute("PRAGMA journal_mode=WAL")
    # Synchronous NORMAL for balanced safety/speed
    cursor.execute("PRAGMA synchronous=NORMAL")
    # Larger cache for better read performance
    cursor.execute("PRAGMA cache_size=10000")
    # Memory-mapped I/O (256MB)
    cursor.execute("PRAGMA mmap_size=268435456")
    # Temp store in memory
    cursor.execute("PRAGMA temp_store=MEMORY")
    # Enforce declared foreign key constraints
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_database_url() -> str:
    """Return the configured database URL.

    Tests can override this with ``FRIDGE_CHEF_DATABASE_URL`` or by calling
    ``reconfigure_database()`` directly.
    """
    return os.getenv("FRIDGE_CHEF_DATABASE_URL", DEFAULT_DATABASE_URL)


def _create_engine(database_url: str):
    """Create a SQLite engine for the provided database URL."""
    engine_kwargs = {
        "connect_args": {"check_same_thread": False},
        "echo": False,
    }

    if database_url in {"sqlite://", "sqlite:///:memory:"}:
        engine_kwargs["poolclass"] = StaticPool
    else:
        engine_kwargs.update(
            {
                "poolclass": QueuePool,
                "pool_size": 5,
                "max_overflow": 10,
                "pool_timeout": 30,
                "pool_pre_ping": True,  # Check connection health
            }
        )

    engine = create_engine(database_url, **engine_kwargs)
    event.listen(engine, "connect", _configure_sqlite_pragmas)
    return engine


def _bind_session_factory(engine_instance) -> None:
    """Bind the global session factory to a specific engine."""
    SessionLocal.configure(bind=engine_instance)


def get_engine():
    """Get or create the database engine (singleton pattern)."""
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = _create_engine(get_database_url())
                _bind_session_factory(_engine)
    return _engine


def reconfigure_database(database_url: str | None = None):
    """Recreate the singleton engine with a new database URL.

    This is primarily intended for test isolation so each test can use an
    isolated SQLite database without touching the app's on-disk database.
    """
    global _engine, engine
    with _engine_lock:
        if _engine is not None:
            _engine.dispose()
        _engine = _create_engine(database_url or get_database_url())
        engine = _engine
        _bind_session_factory(_engine)
    return _engine


# Engine reference for backward compatibility
engine = get_engine()


def get_session() -> Session:
    """Get a new database session."""
    return SessionLocal()


@contextmanager
def get_db():
    """Context manager for database sessions.

    Usage:
        with get_db() as session:
            # Use session
            pass
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def close_all_connections():
    """Close all database connections (for cleanup)."""
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None
