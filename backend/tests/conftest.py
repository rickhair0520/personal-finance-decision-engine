import os
import pytest
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

TEST_DB_URL = "sqlite:///./test_budget.db"
os.environ.setdefault("DATABASE_URL", TEST_DB_URL)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

engine_test = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


def override_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    from app.db.database import Base
    Base.metadata.drop_all(bind=engine_test)
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def client(setup_db):
    from main import app
    from app.db.database import get_db
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers(client):
    client.post("/api/v1/auth/signup", json={"email": "budget@test.com", "password": "testpass123"})
    r = client.post("/api/v1/auth/login", json={"email": "budget@test.com", "password": "testpass123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
