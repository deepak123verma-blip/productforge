import { redirect } from "next/navigation";
import { getRepository, type Creator } from "../db/repositories";
import { getSessionProvider, type Session } from "./session";

/** Server helpers gating routes. Unauthenticated → /login. */

export async function requireCreator(): Promise<{ session: Session; creator: Creator }> {
  const session = await getSessionProvider().getSession();
  if (!session || session.creatorId === null) redirect("/login");
  const creator = await getRepository().getCreatorById(session.creatorId);
  if (!creator) redirect("/login");
  return { session, creator };
}

export async function requireAdmin(): Promise<Session> {
  const session = await getSessionProvider().getSession();
  if (!session || !session.isAdmin) redirect("/login");
  return session;
}
