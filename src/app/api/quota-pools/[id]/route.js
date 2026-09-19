import { NextResponse } from "next/server";
import { getPool, updatePool, deletePool } from "@/lib/localDb";

// GET /api/quota-pools/[id] - Get single pool (with current usage)
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const pool = await getPool(id);
    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    const { getPoolUsage } = await import("@/lib/localDb");
    const usage = await getPoolUsage(pool.id, pool.resetPeriod);
    return NextResponse.json({ pool: { ...pool, usedTokens: usage.tokens, usedCost: usage.cost } });
  } catch (error) {
    console.log("Error fetching pool:", error);
    return NextResponse.json({ error: "Failed to fetch pool" }, { status: 500 });
  }
}

// PUT /api/quota-pools/[id] - Update pool
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, tokenLimit, costLimit, resetPeriod } = body;

    const existing = await getPool(id);
    if (!existing) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const updateData = {};
    const numeric = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
    if (name !== undefined) updateData.name = name;
    if (tokenLimit !== undefined) updateData.tokenLimit = numeric(tokenLimit);
    if (costLimit !== undefined) updateData.costLimit = numeric(costLimit);
    if (resetPeriod !== undefined) updateData.resetPeriod = resetPeriod;

    const updated = await updatePool(id, updateData);
    return NextResponse.json({ pool: updated });
  } catch (error) {
    console.log("Error updating pool:", error);
    return NextResponse.json({ error: "Failed to update pool" }, { status: 500 });
  }
}

// DELETE /api/quota-pools/[id] - Delete pool
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deletePool(id);
    if (!deleted) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Pool deleted successfully" });
  } catch (error) {
    console.log("Error deleting pool:", error);
    return NextResponse.json({ error: "Failed to delete pool" }, { status: 500 });
  }
}