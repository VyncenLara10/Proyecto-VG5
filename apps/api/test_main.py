from fastapi.testclient import TestClient
from main import app


def test_metrics():
    r = TestClient(app).get("/metrics")
    assert r.status_code == 200


def test_rechaza_cantidad_negativa():
    r = TestClient(app).post("/products", json={"nombre": "X", "cantidad": -5})
    assert r.status_code == 422


def test_rechaza_nombre_vacio():
    r = TestClient(app).post("/products", json={"nombre": "", "cantidad": 1})
    assert r.status_code == 422


def test_rechaza_nombre_solo_espacios():
    r = TestClient(app).post("/products", json={"nombre": "   ", "cantidad": 1})
    assert r.status_code == 422
