"""Integration tests against a disposable Sicou database (stdlib only).

Set SICOU_TEST_BASE_URL, SICOU_TEST_ADMIN_EMAIL and SICOU_TEST_ADMIN_PASSWORD.
Never run against production: fixtures include password resets and role changes.
"""
import os
import secrets
import subprocess
import unittest
import uuid
import test_guide_module as api

api.BASE_URL = os.environ.get("SICOU_TEST_BASE_URL", "http://localhost:5189")


class RecoveryNotificationsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin = api.expect("/api/auth/login", "POST", {
            "email": os.environ["SICOU_TEST_ADMIN_EMAIL"],
            "password": os.environ["SICOU_TEST_ADMIN_PASSWORD"]})["accessToken"]
        cls.suffix = uuid.uuid4().hex[:12]
        cls.company = api.expect("/api/companies", "POST", {"name": "Recovery " + cls.suffix}, cls.admin, 201)["id"]
        cls.other_company = api.expect("/api/companies", "POST", {"name": "Foreign " + cls.suffix}, cls.admin, 201)["id"]
        cls.area = api.expect(f"/api/companies/{cls.company}/areas", "POST", {
            "name": "RH", "moduleCodes": ["Guide", "Informatives", "Workflows"]}, cls.admin, 201)["id"]
        cls.other_area = api.expect(f"/api/companies/{cls.company}/areas", "POST", {
            "name": "Financeiro", "moduleCodes": ["Guide", "Informatives"]}, cls.admin, 201)["id"]
        cls.tokens = {}
        cls.ids = {}
        for name, company, role, access in [
            ("company_admin", cls.company, "COMPANY_ADMIN", None),
            ("peer_admin", cls.company, "COMPANY_ADMIN", None),
            ("area_admin", cls.company, "AREA_ADMIN", {"canView": True, "canManage": True}),
            ("manager", cls.company, "HEADQUARTER_USER", {"canView": True, "canManageGuide": True, "canHandleWorkflowRequests": True}),
            ("reader", cls.company, "HEADQUARTER_USER", {"canView": True}),
            ("denied", cls.company, "HEADQUARTER_USER", None),
            ("foreign", cls.other_company, "COMPANY_ADMIN", None),
        ]:
            email = f"recovery-{name}-{cls.suffix}@example.test"
            password = "TestA1!" + secrets.token_hex(12)
            user = api.expect("/api/users", "POST", {"fullName": name, "email": email, "password": password,
                "companyId": company, "roles": [role]}, cls.admin, 201)
            cls.ids[name] = user["id"]
            cls.tokens[name] = api.expect("/api/auth/login", "POST", {"email": email, "password": password})["accessToken"]
            if access:
                api.expect("/api/user-area-accesses", "POST", {
                    "userId": user["id"], "companyId": company, "areaId": cls.area, **access}, cls.admin, 201)

    def new_user(self):
        email = f"reset-{uuid.uuid4().hex}@example.test"
        password = "BeforeA1!" + secrets.token_hex(8)
        user = api.expect("/api/users", "POST", {"fullName": "Reset target", "email": email,
            "password": password, "companyId": self.company, "roles": ["HEADQUARTER_USER"]}, self.admin, 201)
        token = api.expect("/api/auth/login", "POST", {"email": email, "password": password})["accessToken"]
        return user, email, password, token

    def recover(self, user_id, token=None, status=200):
        return api.expect(f"/api/password-recovery/users/{user_id}/temporary-password", "POST",
            token=token or self.tokens["company_admin"], status=status)

    def notifications(self, name):
        return api.expect("/api/notifications?pageSize=50", token=self.tokens[name])

    def post(self, company=None, area=None, global_post=False, token=None):
        boundary = "notification-" + uuid.uuid4().hex
        values = {"title": "Aviso", "content": "Conteúdo", "companyId": company or self.company,
                  "publishToAllCompanies": str(global_post).lower()}
        if area:
            values["areaId"] = area
        raw = b"".join((f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode() for k, v in values.items())
        raw += f"--{boundary}--\r\n".encode()
        return api.expect("/api/posts", "POST", token=token or self.admin, status=201,
            raw=raw, content_type=f"multipart/form-data; boundary={boundary}")

    def test_recovery_requires_authentication(self):
        api.expect("/api/password-recovery/users", status=401)

    def test_area_admin_cannot_recover(self):
        self.recover(self.ids["reader"], self.tokens["area_admin"], 403)

    def test_regular_user_cannot_recover(self):
        self.recover(self.ids["manager"], self.tokens["reader"], 403)

    def test_cannot_reset_peer_or_superior(self):
        self.recover(self.ids["peer_admin"], status=403)
        self.recover(self.ids["foreign"], status=403)

    def test_cannot_reset_self(self):
        self.recover(self.ids["company_admin"], status=403)

    def test_candidate_list_obeys_scope(self):
        eligible = api.expect("/api/password-recovery/users", token=self.tokens["company_admin"])
        ids = {u["id"] for u in eligible}
        self.assertIn(self.ids["reader"], ids)
        self.assertIn(self.ids["area_admin"], ids)
        self.assertNotIn(self.ids["foreign"], ids)
        self.assertNotIn(self.ids["peer_admin"], ids)

    def test_full_temporary_password_flow_and_revocation(self):
        user, email, original, old_token = self.new_user()
        temporary = self.recover(user["id"])["temporaryPassword"]
        api.expect("/api/auth/me", token=old_token, status=401)
        api.expect("/api/auth/login", "POST", {"email": email, "password": original}, status=401)
        session = api.expect("/api/auth/login", "POST", {"email": email, "password": temporary})
        self.assertTrue(session["user"]["mustChangePassword"])
        token = session["accessToken"]
        api.expect("/api/notifications", token=token, status=403)
        api.expect("/api/posts", token=token, status=403)
        api.expect("/api/auth/change-password", "POST", {"currentPassword": temporary, "newPassword": temporary}, token, 400)
        api.expect("/api/auth/change-password", "POST", {"currentPassword": temporary, "newPassword": "short"}, token, 400)
        self.assertTrue(api.expect("/api/auth/me", token=token)["mustChangePassword"])
        password = "DefinitiveA1!" + secrets.token_hex(8)
        final = api.expect("/api/auth/change-password", "POST", {"currentPassword": temporary, "newPassword": password}, token)
        self.assertFalse(final["user"]["mustChangePassword"])
        api.expect("/api/notifications", token=final["accessToken"])
        api.expect("/api/auth/me", token=token, status=401)
        api.expect("/api/auth/login", "POST", {"email": email, "password": temporary}, status=401)
        self.assertFalse(api.expect("/api/auth/login", "POST", {"email": email, "password": password})["user"]["mustChangePassword"])

    def test_new_generation_replaces_previous_temporary_password(self):
        user, email, _, _ = self.new_user()
        first = self.recover(user["id"])["temporaryPassword"]
        old = api.expect("/api/auth/login", "POST", {"email": email, "password": first})["accessToken"]
        second = self.recover(user["id"])["temporaryPassword"]
        self.assertNotEqual(first, second)
        api.expect("/api/auth/me", token=old, status=401)
        api.expect("/api/auth/login", "POST", {"email": email, "password": first}, status=401)
        api.expect("/api/auth/login", "POST", {"email": email, "password": second})

    def test_temporary_password_expiration(self):
        database = os.environ.get("SICOU_TEST_DATABASE", "")
        if not database.startswith("sicou_feature_tests_"):
            self.skipTest("Expiration fixture requires a disposable PostgreSQL database.")
        user, email, _, _ = self.new_user()
        temporary = self.recover(user["id"])["temporaryPassword"]
        token = api.expect("/api/auth/login", "POST", {"email": email, "password": temporary})["accessToken"]
        user_id = str(uuid.UUID(user["id"]))
        subprocess.run([os.environ["SICOU_TEST_PSQL"], "-h", "localhost", "-p", "5433", "-U", "postgres", "-d", database,
            "-w", "-v", "ON_ERROR_STOP=1", "-c",
            f'''UPDATE users SET "TemporaryPasswordExpiresAt" = NOW() - INTERVAL '1 minute' WHERE "Id" = '{user_id}';'''],
            check=True, capture_output=True)
        api.expect("/api/auth/login", "POST", {"email": email, "password": temporary}, status=401)
        api.expect("/api/auth/me", token=token, status=401)

    def test_unauthenticated_promotion_is_forbidden(self):
        api.expect("/api/admin-setup/promote-super-admin?email=unknown@example.test", "POST", status=401)

    def test_area_post_notifies_only_authorized_company_users(self):
        before = {name: self.notifications(name)["totalCount"] for name in ["reader", "manager", "denied", "foreign"]}
        self.post(area=self.area)
        self.assertEqual(self.notifications("reader")["totalCount"], before["reader"] + 1)
        self.assertEqual(self.notifications("manager")["totalCount"], before["manager"] + 1)
        self.assertEqual(self.notifications("denied")["totalCount"], before["denied"])
        self.assertEqual(self.notifications("foreign")["totalCount"], before["foreign"])

    def test_general_post_notifies_own_company_only(self):
        before = {name: self.notifications(name)["totalCount"] for name in ["reader", "denied", "foreign"]}
        self.post()
        for name in ["reader", "denied"]:
            self.assertEqual(self.notifications(name)["totalCount"], before[name] + 1)
        self.assertEqual(self.notifications("foreign")["totalCount"], before["foreign"])

    def test_unrelated_area_does_not_notify_reader(self):
        before = self.notifications("reader")["totalCount"]
        self.post(area=self.other_area)
        self.assertEqual(self.notifications("reader")["totalCount"], before)

    def test_draft_guide_notifies_managers_not_readers(self):
        base = f"/api/areas/{self.area}/guide"
        category = api.expect(base + "/categories", "POST", {"name": "Procedimentos " + uuid.uuid4().hex}, self.admin, 201)
        before = {name: self.notifications(name)["totalCount"] for name in ["reader", "manager", "foreign"]}
        api.expect(base + "/items", "POST", {"categoryId": category["id"], "title": "Privado", "isPublished": False}, self.admin, 201)
        self.assertEqual(self.notifications("reader")["totalCount"], before["reader"])
        self.assertEqual(self.notifications("manager")["totalCount"], before["manager"] + 1)
        self.assertEqual(self.notifications("foreign")["totalCount"], before["foreign"])

    def test_published_guide_notifies_reader(self):
        base = f"/api/areas/{self.area}/guide"
        category = api.expect(base + "/categories", "POST", {"name": "Publicadas " + uuid.uuid4().hex}, self.admin, 201)
        before = self.notifications("reader")["totalCount"]
        api.expect(base + "/items", "POST", {"categoryId": category["id"], "title": "Público", "isPublished": True}, self.admin, 201)
        self.assertEqual(self.notifications("reader")["totalCount"], before + 1)

    def test_guide_notifications_describe_orientation_and_attachment_actions(self):
        base = f"/api/areas/{self.area}/guide"
        category = api.expect(base + "/categories", "POST", {"name": "Férias " + uuid.uuid4().hex}, self.admin, 201)
        payload = {"categoryId": category["id"], "title": "Solicitação de férias", "content": "Procedimento", "isPublished": True}
        item = api.expect(base + "/items", "POST", payload, self.admin, 201)
        url = base + "/items/" + item["id"]

        def assert_notice(action):
            title = self.notifications("reader")["items"][0]["title"]
            self.assertIn("Orientador: " + action, title)
            self.assertIn("Solicitação de férias", title)
            self.assertIn("RH", title)

        assert_notice("nova orientação")
        api.expect(url, "PUT", {**payload, "content": "Procedimento atualizado"}, self.admin)
        assert_notice("orientação atualizada")
        api.upload(url + "/file", self.admin)
        assert_notice("anexo adicionado")
        api.upload(url + "/file", self.admin, content=b"novo anexo", filename="novo.txt")
        assert_notice("anexo atualizado")
        api.expect(url + "/file", "DELETE", token=self.admin, status=204)
        assert_notice("anexo removido")
        api.expect(url, "DELETE", token=self.admin, status=204)
        assert_notice("orientação removida")

    def test_guide_publication_notices_preserve_draft_privacy(self):
        base = f"/api/areas/{self.area}/guide"
        category = api.expect(base + "/categories", "POST", {"name": "Rascunhos " + uuid.uuid4().hex}, self.admin, 201)
        payload = {"categoryId": category["id"], "title": "Instrução reservada", "isPublished": False}
        before = self.notifications("reader")["totalCount"]
        item = api.expect(base + "/items", "POST", payload, self.admin, 201)
        self.assertIn("novo rascunho", self.notifications("manager")["items"][0]["title"])
        self.assertEqual(self.notifications("reader")["totalCount"], before)
        url = base + "/items/" + item["id"]
        api.expect(url, "PUT", {**payload, "isPublished": True}, self.admin)
        self.assertIn("orientação publicada", self.notifications("reader")["items"][0]["title"])
        before = self.notifications("reader")["totalCount"]
        api.expect(url, "PUT", {**payload, "title": "Novo título privado"}, self.admin)
        self.assertIn("retirada de publicação", self.notifications("manager")["items"][0]["title"])
        self.assertEqual(self.notifications("reader")["totalCount"], before)
        self.assertFalse(any("Novo título privado" in n["title"] for n in self.notifications("reader")["items"]))

    def test_read_is_private_and_idempotent(self):
        self.post()
        notification = self.notifications("reader")["items"][0]
        url = f"/api/notifications/{notification['id']}/read"
        api.expect(url, "PUT", token=self.tokens["foreign"], status=404)
        before = self.notifications("reader")["unreadCount"]
        api.expect(url, "PUT", token=self.tokens["reader"], status=204)
        api.expect(url, "PUT", token=self.tokens["reader"], status=204)
        self.assertEqual(self.notifications("reader")["unreadCount"], before - 1)

    def test_mark_all_read_does_not_change_other_users(self):
        self.post()
        before = self.notifications("manager")["unreadCount"]
        api.expect("/api/notifications/read-all", "PUT", token=self.tokens["reader"], status=204)
        self.assertEqual(self.notifications("reader")["unreadCount"], 0)
        self.assertEqual(self.notifications("manager")["unreadCount"], before)

    def test_invalid_action_does_not_create_notifications(self):
        before = self.notifications("reader")["totalCount"]
        api.expect(f"/api/areas/{self.area}/guide/items", "POST", {"categoryId": str(uuid.uuid4()), "title": "Invalid"}, self.admin, 404)
        self.assertEqual(self.notifications("reader")["totalCount"], before)

    def test_notifications_hide_revoked_area_access(self):
        user, email, password, _ = self.new_user()
        access = api.expect("/api/user-area-accesses", "POST", {"userId": user["id"], "companyId": self.company,
            "areaId": self.area, "canView": True}, self.admin, 201)
        token = api.expect("/api/auth/login", "POST", {"email": email, "password": password})["accessToken"]
        self.post(area=self.area)
        self.assertGreater(api.expect("/api/notifications", token=token)["totalCount"], 0)
        api.expect(f"/api/user-area-accesses/{access['id']}", "DELETE", token=self.admin, status=204)
        self.assertEqual(api.expect("/api/notifications", token=token)["totalCount"], 0)

    def test_post_edit_and_delete_generate_notifications(self):
        post = self.post(area=self.area)
        before = self.notifications("reader")["totalCount"]
        boundary = "edit-" + uuid.uuid4().hex
        raw = (f'--{boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nAtualizado\r\n'
               f'--{boundary}\r\nContent-Disposition: form-data; name="content"\r\n\r\nNovo conteúdo\r\n'
               f'--{boundary}--\r\n').encode()
        api.expect(f"/api/posts/{post['id']}", "PUT", token=self.admin,
            raw=raw, content_type=f"multipart/form-data; boundary={boundary}")
        self.assertEqual(self.notifications("reader")["totalCount"], before + 1)
        api.expect(f"/api/posts/{post['id']}", "DELETE", token=self.admin, status=204)
        self.assertEqual(self.notifications("reader")["totalCount"], before + 2)

    def test_workflow_actions_notify_authorized_users(self):
        node = api.expect(f"/api/areas/{self.area}/process-nodes", "POST", {
            "code": "start-" + uuid.uuid4().hex[:8], "name": "Confecção", "nodeType": "StartConfection"}, self.admin, 201)
        tree = api.expect(f"/api/areas/{self.area}/process-types", "POST", {
            "code": "tree-" + uuid.uuid4().hex[:8], "name": "Solicitação", "startNodeId": node["id"]}, self.admin, 201)
        before = self.notifications("manager")["totalCount"]
        process = api.expect("/api/processes", "POST", {"processTypeId": tree["id"], "isDraft": True}, self.admin, 201)
        self.assertEqual(self.notifications("manager")["totalCount"], before + 1)
        api.expect(f"/api/processes/{process['id']}/protocol", "POST", {}, self.admin)
        self.assertEqual(self.notifications("manager")["totalCount"], before + 2)
        api.expect(f"/api/processes/{process['id']}/comments", "POST", {"observations": "Atualização"}, self.admin)
        self.assertEqual(self.notifications("manager")["totalCount"], before + 3)

    def test_legacy_global_post_does_not_send_cross_company_notifications(self):
        before = {name: self.notifications(name)["totalCount"] for name in ["reader", "foreign"]}
        self.post(global_post=True)
        for name in before:
            self.assertEqual(self.notifications(name)["totalCount"], before[name])

    def test_process_notifications_respect_origin_unit(self):
        units = [api.expect(f"/api/companies/{self.company}/units", "POST", {
            "name": "Unidade " + str(i), "code": uuid.uuid4().hex[:12]}, self.admin, 201)["id"] for i in range(2)]
        tokens = []
        for i, unit in enumerate(units):
            email = f"unit-{uuid.uuid4().hex}@example.test"
            password = "UnitA1!" + secrets.token_hex(8)
            user = api.expect("/api/users", "POST", {"fullName": "Unit reader", "email": email,
                "password": password, "companyId": self.company, "unitId": unit, "roles": ["UNIT_USER"]}, self.admin, 201)
            api.expect("/api/user-area-accesses", "POST", {"userId": user["id"], "companyId": self.company,
                "areaId": self.area, "canView": True}, self.admin, 201)
            tokens.append(api.expect("/api/auth/login", "POST", {"email": email, "password": password})["accessToken"])
        node = api.expect(f"/api/areas/{self.area}/process-nodes", "POST", {
            "code": "start-" + uuid.uuid4().hex[:8], "name": "Confecção", "nodeType": "StartConfection"}, self.admin, 201)
        tree = api.expect(f"/api/areas/{self.area}/process-types", "POST", {
            "code": "tree-" + uuid.uuid4().hex[:8], "name": "Processo de unidade", "startNodeId": node["id"]}, self.admin, 201)
        before = [api.expect("/api/notifications", token=t)["totalCount"] for t in tokens]
        api.expect("/api/processes", "POST", {"processTypeId": tree["id"], "isDraft": False, "originUnitId": units[0]}, self.admin, 201)
        self.assertEqual(api.expect("/api/notifications", token=tokens[0])["totalCount"], before[0] + 1)
        self.assertEqual(api.expect("/api/notifications", token=tokens[1])["totalCount"], before[1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
