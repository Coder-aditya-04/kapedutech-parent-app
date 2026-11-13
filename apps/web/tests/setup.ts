// Fixed secrets for the suite. lib/auth reads JWT_SECRET at import time, so
// this runs before any test file imports it.
process.env["JWT_SECRET"] = "test-jwt-secret";
process.env["ADMIN_SECRET"] = "test-admin-secret";
process.env["KAPCORE_URL"] = "https://core.test/";
process.env["KAPCORE_API_KEY"] = "test-kapcore-key";
process.env["KAPCORE_WEBHOOK_SECRET"] = "test-webhook-secret";
