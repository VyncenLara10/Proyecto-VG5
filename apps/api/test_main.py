from fastapi.testclient import TestClient
from main import app


def test_metrics():
    r = TestClient(app).get("/metrics")
    assert r.status_code == 200
