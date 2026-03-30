"""Shared pytest fixtures for Fridge Chef."""

import pytest

import db.database as database
from db.models import Base


@pytest.fixture(autouse=True)
def isolated_database():
    """Use an isolated in-memory SQLite database for every test."""
    database.reconfigure_database("sqlite://")
    Base.metadata.create_all(bind=database.engine)
    try:
        yield
    finally:
        Base.metadata.drop_all(bind=database.engine)
        database.reconfigure_database()
