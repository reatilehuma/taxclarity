export interface AuditEntry {
  at: string;
  question: string;
  reply: string;
  /** Rand amounts the reply quoted that match the calculator. */
  matched: number[];
  /** Amounts that did not match. If there are any, the reply was replaced and never shown. */
  invented: number[];
  verdict: "shown" | "replaced";
}

/** A record of what the assistant said, kept in memory for this visit only. Nothing is stored or sent. */
export class AuditLog {
  private items: AuditEntry[] = [];

  record(entry: Omit<AuditEntry, "at">): AuditEntry {
    const full = { at: new Date().toISOString(), ...entry };
    this.items.push(full);
    return full;
  }

  entries(): readonly AuditEntry[] {
    return this.items;
  }

  clear(): void {
    this.items = [];
  }
}
