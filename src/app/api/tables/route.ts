// src/app/api/tables/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../Lib/Connectdb";
import Table from "../../Models/Table";

const VALID_STATUSES = ["Available", "In Use", "Maintenance"];

// GET all tables
export async function GET() {
  try {
    await connectDB();
    const tables = await Table.find().sort({ createdAt: 1 }).lean();
    return NextResponse.json(tables);
  } catch (err) {
    console.error("GET /api/tables error:", err);
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
  }
}

// POST create new table
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { name, status = "Available", note = "" } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Table name is required" }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await Table.findOne({ name: name.trim() });
    if (existing) {
      return NextResponse.json(
        { error: `A table named "${name.trim()}" already exists` },
        { status: 409 }
      );
    }

    const table = await Table.create({
      name: name.trim(),
      status,
      note: note.trim(),
      sessionStartedAt: null,
      totalMinutes: 0,
      sessions: [],
    });

    return NextResponse.json(table, { status: 201 });
  } catch (err) {
    console.error("POST /api/tables error:", err);
    return NextResponse.json({ error: "Failed to create table" }, { status: 500 });
  }
}