import { NextResponse } from "next/server";
import { getPools, createPool } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// GET /api/quota-pools - List quota pools (with current usage)
export async function GET() {
  try {
    const pools = await getPools();
    const enriched = [];
    for (const p of pools) {
      const { getPoolUsage } = await import("@/lib/localDb");
      const usage = await getPoolUsage(p.id, p.resetPeriod);
      enriched.push({ ...p, usedTokens: usage.tokens, usedCost: usage.cost });
    }
    return NextResponse.json({ pools: enriched });
  } catch (error) {
    console.log("Error fetching quota pools:", error);
    return NextResponse.json({ error: "Failed to fetch quota pools" }, { status: 500 });
  }
}

// POST /api/quota-pools - Create quota pool
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, tokenLimit, costLimit, resetPeriod } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const numeric = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
    const pool = await createPool({
      name,
      tokenLimit: numeric(tokenLimit),
      costLimit: numeric(costLimit),
      resetPeriod: resetPeriod || "monthly",
    });

    return NextResponse.json({ pool }, { status: 201 });
  } catch (error) {
    console.log("Error creating pool:", error);
    return NextResponse.json({ error: "Failed to create pool" }, { status: 500 });
  }
}