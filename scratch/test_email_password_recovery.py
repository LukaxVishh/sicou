"""Password recovery over real SMTP to local Mailpit; disposable database only."""
import json
import os
import re
import secrets
import subprocess
import unittest
import urllib.parse
import urllib.request
import uuid
import test_guide_module as api

api.BASE_URL = os.environ.get("SICOU_TEST_BASE_URL", "http://localhost:5189")
MAILBOX = os.environ.get("SICOU_TEST_MAILBOX_URL", "http://localhost:8025")


def mailbox(path):
    with urllib.request.urlopen(MAILBOX + path, timeout=10) as response:
        return json.load(response)


class EmailRecoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin = api.expect("/api/auth/login", "POST", {"email": os.environ["SICOU_TEST_ADMIN_EMAIL"],
            "password": os.environ["SICOU_TEST_ADMIN_PASSWORD"]})["accessToken"]

    def new_user(self):
        email = f"email-reset-{uuid.uuid4().hex}@example.test"
        password = "BeforeA1!" + secrets.token_hex(12)
        user = api.expect("/api/users", "POST", {"fullName": "Email reset fixture", "email": email,
            "password": password, "roles": ["HEADQUARTER_USER"]}, self.admin, 201)
        token = api.expect("/api/auth/login", "POST", {"email": email, "password": password})["accessToken"]
        return user, email, password, token

    def link(self, email):
        api.expect("/api/auth/forgot-password", "POST", {"email": email})
        messages = mailbox("/api/v1/messages")["messages"]
        matching = [message for message in messages if any(address["Address"] == email for address in message["To"])]
        self.assertTrue(matching, "A recuperação deve entregar uma mensagem ao SMTP local.")
        body = mailbox("/api/v1/message/" + matching[0]["ID"])
        link = re.search(r"https?://[^\s]+", body["Text"]).group(0)
        self.assertEqual(urllib.parse.urlparse(link).netloc, "localhost:5173")
        self.assertEqual(urllib.parse.urlparse(link).path, "/reset-password")
        query = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
        self.assertEqual(query["email"][0], email)
        return query["token"][0]

    def reset(self, email, token, password=None, status=200):
        return api.expect("/api/auth/reset-password", "POST", {
            "email": email, "token": token, "newPassword": password or "AfterA1!" + secrets.token_hex(12)}, status=status)

    def test_email_confirmation_and_one_time_reset(self):
        user, email, original, session = self.new_user()
        token = self.link(email)
        api.expect("/api/auth/login", "POST", {"email": email, "password": original})
        password = "ConfirmedA1!" + secrets.token_hex(8)
        self.reset(email, token, password)
        api.expect("/api/auth/login", "POST", {"email": email, "password": original}, status=401)
        api.expect("/api/auth/me", token=session, status=401)
        final = api.expect("/api/auth/login", "POST", {"email": email, "password": password})
        self.assertFalse(final["user"]["mustChangePassword"])
        self.reset(email, token, status=400)

    def test_unknown_email_returns_same_response_without_delivery(self):
        _, email, _, _ = self.new_user()
        valid = api.expect("/api/auth/forgot-password", "POST", {"email": email})
        before = mailbox("/api/v1/messages")["total"]
        unknown = api.expect("/api/auth/forgot-password", "POST", {"email": uuid.uuid4().hex + "@example.test"})
        self.assertEqual(valid, unknown)
        self.assertEqual(mailbox("/api/v1/messages")["total"], before)
        self.assertNotIn("token", valid)

    def test_new_request_invalidates_previous_link(self):
        _, email, _, _ = self.new_user()
        first = self.link(email)
        second = self.link(email)
        self.assertNotEqual(first, second)
        self.reset(email, first, status=400)
        self.reset(email, second)

    def test_invalid_token_and_wrong_account_are_rejected(self):
        _, email, _, _ = self.new_user()
        _, other, _, _ = self.new_user()
        token = self.link(email)
        self.reset(email, "invalid-token", status=400)
        self.reset(other, token, status=400)
        self.reset(email, token)

    def test_invalid_password_does_not_consume_link(self):
        _, email, _, _ = self.new_user()
        token = self.link(email)
        self.reset(email, token, password="abcdefgh", status=400)
        self.reset(email, token)

    def test_email_change_invalidates_link(self):
        user, email, _, _ = self.new_user()
        token = self.link(email)
        replacement = "replacement-" + uuid.uuid4().hex + "@example.test"
        api.expect(f"/api/users/{user['id']}", "PUT", {"fullName": "Email reset fixture", "email": replacement, "isActive": True}, self.admin)
        self.reset(replacement, token, status=400)

    def test_expired_link_is_rejected(self):
        database = os.environ.get("SICOU_TEST_DATABASE", "")
        if not database.startswith("sicou_feature_tests_"):
            self.skipTest("Requires a disposable PostgreSQL database.")
        user, email, _, _ = self.new_user()
        token = self.link(email)
        user_id = str(uuid.UUID(user["id"]))
        subprocess.run([os.environ["SICOU_TEST_PSQL"], "-h", "localhost", "-p", "5433", "-U", "postgres", "-d", database,
            "-w", "-v", "ON_ERROR_STOP=1", "-c", f'''UPDATE users SET "EmailPasswordResetExpiresAt" = NOW() - INTERVAL '1 minute' WHERE "Id" = '{user_id}';'''],
            check=True, capture_output=True)
        self.reset(email, token, status=400)

    def test_administrative_reset_invalidates_email_link(self):
        user, email, _, _ = self.new_user()
        token = self.link(email)
        temporary = api.expect(f"/api/password-recovery/users/{user['id']}/temporary-password", "POST", token=self.admin)["temporaryPassword"]
        self.reset(email, token, status=400)
        self.assertTrue(api.expect("/api/auth/login", "POST", {"email": email, "password": temporary})["user"]["mustChangePassword"])

    def test_email_reset_completes_temporary_password_recovery(self):
        user, email, _, _ = self.new_user()
        api.expect(f"/api/password-recovery/users/{user['id']}/temporary-password", "POST", token=self.admin)
        token = self.link(email)
        password = "DailyA1!" + secrets.token_hex(8)
        self.reset(email, token, password)
        self.assertFalse(api.expect("/api/auth/login", "POST", {"email": email, "password": password})["user"]["mustChangePassword"])

    def test_z_rate_limit_rejects_excess_requests(self):
        for _ in range(110):
            status, body, _ = api.request("/api/auth/forgot-password", "POST", {"email": "rate-limit-test@example.test"})
            if status == 429:
                self.assertIn("Muitas solicitações", body["message"])
                return
            self.assertEqual(status, 200)
        self.fail("A API deve limitar solicitações repetidas de recuperação.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
