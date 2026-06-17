def test_budget_models_importable():
    from app.models import BudgetVersion, BudgetLine
    assert BudgetVersion.__tablename__ == "budget_versions"
    assert BudgetLine.__tablename__ == "budget_lines"


def test_list_versions_empty(client, auth_headers):
    r = client.get("/api/v1/budget/versions", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_create_version_seeds_defaults(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Base Plan"}, headers=auth_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Base Plan"
    assert body["is_baseline"] is True
    assert body["total"] == 0.0
    # Lines should be seeded
    lines_r = client.get(f"/api/v1/budget/versions/{body['id']}/lines", headers=auth_headers)
    assert lines_r.status_code == 200
    categories = [l["category"] for l in lines_r.json()]
    assert "Foundation" in categories
    assert "Kitchen" in categories
    assert len(categories) == 16


def test_second_version_not_baseline(client, auth_headers):
    client.post("/api/v1/budget/versions", json={"name": "V1"}, headers=auth_headers)
    r = client.post("/api/v1/budget/versions", json={"name": "V2"}, headers=auth_headers)
    assert r.json()["is_baseline"] is False


def test_bulk_update_lines(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Test"}, headers=auth_headers)
    version_id = r.json()["id"]
    lines = client.get(f"/api/v1/budget/versions/{version_id}/lines", headers=auth_headers).json()
    # Update Foundation to 70000
    for line in lines:
        if line["category"] == "Foundation":
            line["amount"] = 70000.0
    update_r = client.put(
        f"/api/v1/budget/versions/{version_id}/lines",
        json=lines,
        headers=auth_headers,
    )
    assert update_r.status_code == 200
    # Total should now reflect
    versions_r = client.get("/api/v1/budget/versions", headers=auth_headers)
    v = next(v for v in versions_r.json() if v["id"] == version_id)
    assert v["total"] == 70000.0


def test_duplicate_version(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Original"}, headers=auth_headers)
    vid = r.json()["id"]
    # Update a line
    lines = client.get(f"/api/v1/budget/versions/{vid}/lines", headers=auth_headers).json()
    lines[0]["amount"] = 99000.0
    client.put(f"/api/v1/budget/versions/{vid}/lines", json=lines, headers=auth_headers)
    # Duplicate
    dup_r = client.post(f"/api/v1/budget/versions/{vid}/duplicate", headers=auth_headers)
    assert dup_r.status_code == 201
    dup_id = dup_r.json()["id"]
    dup_lines = client.get(f"/api/v1/budget/versions/{dup_id}/lines", headers=auth_headers).json()
    assert dup_lines[0]["amount"] == 99000.0


def test_delete_only_version_blocked(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Only"}, headers=auth_headers)
    vid = r.json()["id"]
    del_r = client.delete(f"/api/v1/budget/versions/{vid}", headers=auth_headers)
    assert del_r.status_code == 400


def test_rename_version(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Old Name"}, headers=auth_headers)
    vid = r.json()["id"]
    rename_r = client.put(
        f"/api/v1/budget/versions/{vid}",
        json={"name": "New Name"},
        headers=auth_headers,
    )
    assert rename_r.status_code == 200
    assert rename_r.json()["name"] == "New Name"
