/**
 * The session boundary. Pages never assume who is signed in — they ask
 * this interface. The mock signs in the fixture creator (Maya, who is
 * also an admin so /admin is reachable offline); the Supabase provider
 * drops in behind the same interface in Phase 2 without touching pages.
 */

export interface Session {
  userId: string;
  email: string;
  creatorId: string | null;
  isAdmin: boolean;
}

export interface SessionProvider {
  getSession(): Promise<Session | null>;
}

const mockProvider: SessionProvider = {
  async getSession() {
    return { userId: "u-maya", email: "maya@example.com", creatorId: "c-maya", isAdmin: true };
  },
};

const supabaseProvider: SessionProvider = {
  async getSession() {
    throw new Error("supabase session provider: not implemented until Phase 2");
  },
};

export function getSessionProvider(): SessionProvider {
  return process.env.DATA_BACKEND === "supabase" ? supabaseProvider : mockProvider;
}
