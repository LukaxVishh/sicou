"""HTTP integration suite for Orientador (Python standard library only).

Run against a disposable development database. Creates uniquely named fixtures;
cleanup deletes guide content and deactivates fixtures through the existing API.
Credentials: SICOU_TEST_ADMIN_EMAIL and SICOU_TEST_ADMIN_PASSWORD.
Usage: python scratch/test_guide_module.py --base-url http://localhost:8080
"""
import argparse
import json
import os
import secrets
import unittest
import urllib.error
import urllib.request
import uuid

BASE_URL = os.environ.get("SICOU_TEST_BASE_URL", "http://localhost:8080")


def request(path, method="GET", data=None, token=None, raw=None, content_type=None):
    headers = {"Content-Type": content_type or "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    req = urllib.request.Request(BASE_URL + path, data=body, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as exc:
        response = exc
    with response:
        payload = response.read()
        if "json" in response.headers.get("Content-Type", "") and payload:
            payload = json.loads(payload)
        return response.status, payload, response.headers


def expect(path, method="GET", data=None, token=None, status=200, **kwargs):
    code, body, headers = request(path, method, data, token, **kwargs)
    if code != status:
        raise AssertionError(f"{method} {path}: expected {status}, received {code}: {body!r}")
    return body


def upload(path, token, content=b"manual de operacao", filename="manual.txt", status=204):
    boundary = "guide-" + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"'
            '\r\nContent-Type: application/octet-stream\r\n\r\n').encode()
    body += content + f"\r\n--{boundary}--\r\n".encode()
    return expect(path, "POST", token=token, status=status, raw=body,
                  content_type=f"multipart/form-data; boundary={boundary}")


class GuideTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        email = os.environ.get("SICOU_TEST_ADMIN_EMAIL")
        password = os.environ.get("SICOU_TEST_ADMIN_PASSWORD")
        if not email or not password:
            raise RuntimeError("Configure SICOU_TEST_ADMIN_EMAIL and SICOU_TEST_ADMIN_PASSWORD (SUPER_ADMIN).")
        cls.admin = expect("/api/auth/login", "POST", {"email": email, "password": password})["accessToken"]
        cls.suffix = uuid.uuid4().hex[:12]
        cls.fixtures = []
        cls.addClassCleanup(cls.cleanup_fixtures)

        def create(path, data, delete_prefix):
            obj = expect(path, "POST", data, cls.admin, 201)
            cls.fixtures.append(f"{delete_prefix}/{obj['id']}")
            return obj["id"]

        cls.company = create("/api/companies", {"name": f"Guide test {cls.suffix}"}, "/api/companies")
        cls.other_company = create("/api/companies", {"name": f"Guide foreign {cls.suffix}"}, "/api/companies")
        cls.area = create(f"/api/companies/{cls.company}/areas", {"name": "Guide enabled", "moduleCodes": ["Guide"]}, "/api/areas")
        cls.second_area = create(f"/api/companies/{cls.company}/areas", {"name": "Guide second", "moduleCodes": ["Guide"]}, "/api/areas")
        cls.disabled_area = create(f"/api/companies/{cls.company}/areas", {"name": "Guide disabled", "moduleCodes": []}, "/api/areas")
        cls.unit = create(f"/api/companies/{cls.company}/units", {"name": "Guide unit", "code": cls.suffix}, "/api/units")
        cls.base = f"/api/areas/{cls.area}/guide"
        for name, company, role, access in [
            ("manager", cls.company, "HEADQUARTER_USER", {"canView": False, "canManageGuide": True}),
            ("reader", cls.company, "UNIT_USER", {"canView": True, "canManageGuide": False}),
            ("denied", cls.company, "HEADQUARTER_USER", None),
            ("foreign", cls.other_company, "COMPANY_ADMIN", None),
            ("company_admin", cls.company, "COMPANY_ADMIN", None),
        ]:
            user_email = f"guide-{name}-{cls.suffix}@example.test"
            user_password = "GuideA1!" + secrets.token_hex(12)
            unit_id = cls.unit if name == "reader" else None
            user_id = create("/api/users", {"fullName": f"Guide {name}", "email": user_email,
                "password": user_password, "companyId": company, "unitId": unit_id, "roles": [role]}, "/api/users")
            if access:
                create("/api/user-area-accesses", {"userId": user_id, "companyId": company,
                    "unitId": unit_id, "areaId": cls.area, **access}, "/api/user-area-accesses")
            token = expect("/api/auth/login", "POST", {"email": user_email, "password": user_password})["accessToken"]
            setattr(cls, name, token)

    @classmethod
    def cleanup_fixtures(cls):
        failures = []
        for path in reversed(cls.fixtures):
            try:
                expect(path, "DELETE", token=cls.admin, status=204)
            except Exception as exc:
                failures.append(str(exc))
        if failures:
            raise AssertionError("Fixture cleanup failed:\n" + "\n".join(failures))

    def setUp(self):
        self.category = expect(self.base + "/categories", "POST", {"name": "Procedimentos", "sortOrder": 2}, self.manager, 201)
        self.addCleanup(self.delete_if_present, self.base + "/categories/" + self.category["id"])

    def delete_if_present(self, path):
        code, body, _ = request(path, "DELETE", token=self.admin)
        self.assertIn(code, (204, 404), f"Cleanup {path}: {code} {body}")

    def create_item(self, **overrides):
        payload = {"categoryId": self.category["id"], "title": "Orientação", "content": "Passo 1\nPasso 2",
                   "url": "https://example.com/manual", "sortOrder": 1, "isPublished": False, **overrides}
        item = expect(self.base + "/items", "POST", payload, self.manager, 201)
        self.addCleanup(self.delete_if_present, self.base + "/items/" + item["id"])
        return item

    def test_anonymous_access_denied(self):
        expect(self.base, status=401)
        expect("/api/guide/areas", status=401)
        expect(self.base + "/categories", "POST", {"name": "No auth"}, status=401)

    def test_accessible_areas(self):
        for token in (self.reader, self.manager):
            areas = expect("/api/guide/areas", token=token)
            self.assertEqual([a["id"] for a in areas], [self.area])
        self.assertEqual(expect("/api/guide/areas", token=self.denied), [])

    def test_company_admin_can_manage(self):
        self.assertTrue(expect(self.base, token=self.company_admin)["canManage"])

    def test_manager_without_view_can_manage(self):
        self.assertTrue(expect(self.base, token=self.manager)["canManage"])
        self.create_item()

    def test_reader_cannot_mutate(self):
        item = self.create_item(isPublished=True)
        for method, path, payload in [
            ("POST", "/categories", {"name": "Blocked"}),
            ("PUT", "/categories/" + self.category["id"], {"name": "Blocked"}),
            ("DELETE", "/categories/" + self.category["id"], None),
            ("POST", "/items", item), ("PUT", "/items/" + item["id"], item),
            ("DELETE", "/items/" + item["id"], None),
            ("DELETE", "/items/" + item["id"] + "/file", None),
        ]:
            with self.subTest(method=method, path=path):
                expect(self.base + path, method, payload, self.reader, 403)
        upload(self.base + "/items/" + item["id"] + "/file", self.reader, status=403)

    def test_no_permission_and_foreign_company_denied(self):
        item = self.create_item(isPublished=True)
        for token in (self.denied, self.foreign):
            for method, path, payload in [("GET", "", None), ("POST", "/items", item),
                ("PUT", "/items/" + item["id"], item), ("DELETE", "/items/" + item["id"], None),
                ("GET", "/items/" + item["id"] + "/file", None)]:
                with self.subTest(method=method, path=path):
                    expect(self.base + path, method, payload, token, 403)

    def test_disabled_module(self):
        path = f"/api/areas/{self.disabled_area}/guide"
        expect(path, token=self.admin, status=400)
        expect(path + "/categories", "POST", {"name": "Blocked"}, self.admin, 400)

    def test_missing_area(self):
        expect(f"/api/areas/{uuid.uuid4()}/guide", token=self.admin, status=404)

    def test_category_update_and_delete(self):
        path = self.base + "/categories/" + self.category["id"]
        edited = expect(path, "PUT", {"name": "Novo nome", "sortOrder": 5}, self.manager)
        self.assertEqual(edited["name"], "Novo nome")
        self.assertEqual(edited["sortOrder"], 5)
        expect(path, "DELETE", token=self.manager, status=204)
        expect(path, "PUT", {"name": "Gone"}, self.manager, 404)

    def test_category_with_items_cannot_be_deleted(self):
        self.create_item()
        expect(self.base + "/categories/" + self.category["id"], "DELETE", token=self.manager, status=400)

    def test_draft_publish_unpublish(self):
        item = self.create_item()
        self.assertNotIn(item["id"], [i["id"] for i in expect(self.base, token=self.reader)["items"]])
        self.assertIn(item["id"], [i["id"] for i in expect(self.base, token=self.manager)["items"]])
        item["isPublished"] = True
        item["title"] = "Publicado"
        updated = expect(self.base + "/items/" + item["id"], "PUT", item, self.manager)
        self.assertEqual(updated["title"], "Publicado")
        self.assertIn(item["id"], [i["id"] for i in expect(self.base, token=self.reader)["items"]])
        item["isPublished"] = False
        expect(self.base + "/items/" + item["id"], "PUT", item, self.manager)
        self.assertNotIn(item["id"], [i["id"] for i in expect(self.base, token=self.reader)["items"]])

    def test_item_ordering_and_delete(self):
        first = self.create_item(title="Primeiro", sortOrder=0)
        last = self.create_item(title="Último", sortOrder=9)
        items = expect(self.base, token=self.manager)["items"]
        ids = [i["id"] for i in items]
        self.assertLess(ids.index(first["id"]), ids.index(last["id"]))
        expect(self.base + "/items/" + first["id"], "DELETE", token=self.manager, status=204)
        self.assertNotIn(first["id"], [i["id"] for i in expect(self.base, token=self.manager)["items"]])

    def test_invalid_category_and_payload(self):
        for payload in ({"name": "   "}, {"name": "x" * 151}, {"name": "Valid", "sortOrder": -1}):
            expect(self.base + "/categories", "POST", payload, self.manager, 400)
        payload = {"categoryId": self.category["id"], "title": "Valid"}
        for overrides in ({"title": " "}, {"title": "x" * 201}, {"content": "x" * 50001},
                          {"sortOrder": -1}, {"url": "javascript:alert(1)"}, {"url": "file:///tmp/file"},
                          {"url": "/relative"}):
            with self.subTest(overrides=list(overrides)):
                expect(self.base + "/items", "POST", {**payload, **overrides}, self.manager, 400)
        expect(self.base + "/items", "POST", {**payload, "categoryId": str(uuid.uuid4())}, self.manager, 404)

    def test_cross_area_ids_rejected(self):
        item = self.create_item()
        other = f"/api/areas/{self.second_area}/guide"
        expect(other + "/items", "POST", item, self.admin, 404)
        expect(other + "/items/" + item["id"], "PUT", item, self.admin, 404)
        expect(other + "/items/" + item["id"], "DELETE", token=self.admin, status=404)
        expect(other + "/categories/" + self.category["id"], "DELETE", token=self.admin, status=404)
        expect(other + "/items/" + item["id"] + "/file", token=self.admin, status=404)

    def test_attachment_lifecycle_and_draft_privacy(self):
        item = self.create_item()
        path = self.base + "/items/" + item["id"] + "/file"
        expect(path, token=self.manager, status=404)
        upload(path, self.manager, b"version one")
        expect(path, token=self.reader, status=404)
        code, body, headers = request(path, token=self.manager)
        self.assertEqual(code, 200)
        self.assertEqual(body, b"version one")
        self.assertIn("attachment", headers["Content-Disposition"])
        self.assertEqual(headers["Cache-Control"], "no-store")
        upload(path, self.manager, b"version two", "replacement.txt")
        item["isPublished"] = True
        expect(self.base + "/items/" + item["id"], "PUT", item, self.manager)
        self.assertEqual(expect(path, token=self.reader), b"version two")
        expect(path, "DELETE", token=self.manager, status=204)
        expect(path, token=self.reader, status=404)

    def test_attachment_size_validation(self):
        item = self.create_item()
        path = self.base + "/items/" + item["id"] + "/file"
        upload(path, self.manager, b"", status=400)
        upload(path, self.manager, b"x" * (10 * 1024 * 1024 + 1), status=400)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=BASE_URL)
    args, remaining = parser.parse_known_args()
    BASE_URL = args.base_url.rstrip("/")
    unittest.main(argv=[__file__, *remaining], verbosity=2)