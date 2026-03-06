import mongoose, { Schema, Document, Model } from "mongoose";

export type TableStatus = "Available" | "In Use" | "Maintenance";

export interface ISession {
  startedAt: Date;
  endedAt?: Date;
  durationMinutes?: number;
}

export interface ITable extends Document {
  name: string;
  status: TableStatus;
  note?: string;
  sessionStartedAt?: Date | null; // null when not in use
  totalMinutes: number;           // accumulated completed session minutes
  sessions: ISession[];           // full session history
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    startedAt:       { type: Date, required: true },
    endedAt:         { type: Date },
    durationMinutes: { type: Number },
  },
  { _id: false }
);

const TableSchema = new Schema<ITable>(
  {
    name:             { type: String, required: true, trim: true },
    status:           { type: String, enum: ["Available", "In Use", "Maintenance"], default: "Available" },
    note:             { type: String, default: "" },
    sessionStartedAt: { type: Date, default: null },
    totalMinutes:     { type: Number, default: 0 },
    sessions:         { type: [SessionSchema], default: [] },
  },
  { timestamps: true }
);

const Table: Model<ITable> =
  mongoose.models.Table || mongoose.model<ITable>("Tables", TableSchema);

export default Table;