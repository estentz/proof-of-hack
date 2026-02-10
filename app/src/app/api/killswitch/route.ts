import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Kill switch endpoint for Z3R0 agent.
 * Returns { active: true } to allow posting, { active: false } to stop.
 *
 * To disable the agent, change AGENT_ACTIVE to "false" in Vercel env vars.
 * Default: active (agent can post).
 */
export async function GET() {
  const active = process.env.AGENT_ACTIVE !== "false";
  return NextResponse.json({ active });
}
