from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_login_works_with_default_dev_credentials() -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["access_token"]
