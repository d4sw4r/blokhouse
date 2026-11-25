// Loaded before every integration test file (vitest.integration.config.js).
// Browser sessions need a Next.js request context, so getServerSession is
// stubbed to "no session"; authentication in these tests uses real API tokens.
// The session path itself is covered by the unit tests.
import { vi } from "vitest";

vi.mock("next-auth/next", () => ({ getServerSession: async () => null }));
