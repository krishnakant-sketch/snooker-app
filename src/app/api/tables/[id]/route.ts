// src/app/api/tables/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/app/Lib/Connectdb";
import Table, { ITable } from "@/app/Models/Table";

const VALID_STATUSES = ["Available", "In Use", "Maintenance"];

// ✅ Next.js 15+ — params is a Promise
type RouteContext = { params: Promise<{ id: string }> };

const isValidId = (id: string) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /api/tables/:id
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!isValidId(id))
    return NextResponse.json({ error: "Invalid table ID" }, { status: 400 });

  try {
    await connectDB();
    const table = await Table.findById(id).lean();
    if (!table)
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json(table, { status: 200 });
  } catch (err) {
    console.error(`[GET /api/tables/${id}]`, err);
    return NextResponse.json({ error: "Failed to fetch table" }, { status: 500 });
  }
}

/**
 * PATCH /api/tables/:id
 * Status transitions:
 *   → "In Use"    : saves sessionStartedAt = now
 *   → anything    : calculates duration, adds to totalMinutes & sessions[]
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!isValidId(id))
    return NextResponse.json({ error: "Invalid table ID" }, { status: 400 });

  try {
    await connectDB();

    const body = await req.json();
    const { name, status, note } = body;

    // ── Name validation ───────────────────────────────────────────
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim())
        return NextResponse.json({ error: "Table name cannot be empty" }, { status: 400 });

      const currentTable = await Table.findById(id).lean() as { name: string } | null;
      if (currentTable?.name !== name.trim()) {
        const duplicate = await Table.findOne({ name: name.trim(), _id: { $ne: id } });
        if (duplicate)
          return NextResponse.json(
            { error: `A table named "${name.trim()}" already exists` },
            { status: 409 }
          );
      }
    }

    // ── Status + Timer logic ──────────────────────────────────────
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status))
        return NextResponse.json(
          { error: `Status must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );

      const current = await Table.findById(id).exec() as ITable | null;
      if (!current)
        return NextResponse.json({ error: "Table not found" }, { status: 404 });

      const now = new Date();

      // ── Separate $set fields from $inc/$push ──────────────────
      const setFields: Record<string, unknown> = {};
      if (name !== undefined)   setFields.name = name.trim();
      if (note !== undefined)   setFields.note = typeof note === "string" ? note.trim() : "";

      if (status === "In Use" && current.status !== "In Use") {
        // ── Starting a new session ────────────────────────────
        setFields.status = "In Use";
        setFields.sessionStartedAt = now;
        console.log("[PATCH] Starting session at:", now);

        const mongoUpdate = { $set: setFields };
        await Table.findByIdAndUpdate(id, mongoUpdate, { new: true, runValidators: true });

      } else if (current.status === "In Use" && status !== "In Use") {
        // ── Ending a session ──────────────────────────────────
        // ✅ Use current.sessionStartedAt from DB — NOT now
        const rawStartedAt = current.sessionStartedAt;
        const startedAt = rawStartedAt ? new Date(rawStartedAt) : now;
        const durationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));

        console.log("[PATCH] Ending session — startedAt:", startedAt, "now:", now, "duration:", durationMinutes, "mins");

        setFields.status = status;
        setFields.sessionStartedAt = null;

        const mongoUpdate = {
          $set: setFields,
          $inc: { totalMinutes: durationMinutes },
          $push: {
            sessions: {
              startedAt,
              endedAt: now,
              durationMinutes,
            },
          },
        };

        await Table.findByIdAndUpdate(id, mongoUpdate, { new: true, runValidators: true });

      } else {
        // ── No session boundary change ────────────────────────
        setFields.status = status;
        const mongoUpdate = { $set: setFields };
        await Table.findByIdAndUpdate(id, mongoUpdate, { new: true, runValidators: true });
      }

      // Always re-fetch fresh doc to return all updated fields
      const fresh = await Table.findById(id).lean();
      console.log("[PATCH] Fresh totalMinutes:", (fresh as unknown as Record<string, unknown>)?.totalMinutes);
      return NextResponse.json(fresh, { status: 200 });
    }

    // ── Name / note only update (no status change) ────────────────
    const setFields: Record<string, unknown> = {};
    if (name !== undefined) setFields.name = name.trim();
    if (note !== undefined) setFields.note = typeof note === "string" ? note.trim() : "";

    if (Object.keys(setFields).length === 0)
      return NextResponse.json({ error: "No valid fields provided to update" }, { status: 400 });

    await Table.findByIdAndUpdate(id, { $set: setFields }, { new: true, runValidators: true });
    const fresh = await Table.findById(id).lean();
    return NextResponse.json(fresh, { status: 200 });

  } catch (err) {
    console.error(`[PATCH /api/tables/${id}]`, err);
    return NextResponse.json({ error: "Failed to update table" }, { status: 500 });
  }
}

/**
 * DELETE /api/tables/:id
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!isValidId(id))
    return NextResponse.json({ error: "Invalid table ID" }, { status: 400 });

  try {
    await connectDB();
    const deleted = await Table.findByIdAndDelete(id);
    if (!deleted)
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json(
      { message: `Table "${deleted.name}" deleted successfully` },
      { status: 200 }
    );
  } catch (err) {
    console.error(`[DELETE /api/tables/${id}]`, err);
    return NextResponse.json({ error: "Failed to delete table" }, { status: 500 });
  }
}