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


def test_health_base_disponible(monkeypatch):
    class ConexionFalsa:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, query):
            assert query == "SELECT 1"

    monkeypatch.setattr("main.db", lambda: ConexionFalsa())

    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "okas"}


def test_health_base_no_disponible(monkeypatch):
    def conexion_fallida():
        raise RuntimeError("Base de datos no disponible")

    monkeypatch.setattr("main.db", conexion_fallida)

    r = TestClient(app).get("/health")
    assert r.status_code == 503
