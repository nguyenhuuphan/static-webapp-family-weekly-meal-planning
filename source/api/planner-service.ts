import type { Database } from "./database";
import type { State, Plan } from "src/types";
import { freshState, hydrateState } from "src/helpers";
import defaults from "../public/meal-plan.json";
import { calculatePlanner, type PlannerEnvelope } from "./calculations";
import { executeCommand, type PlannerCommand, COMMANDS } from "./commands";
import { UUID } from "src/helpers/purchaseHistory";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}
const snapshots = new WeakMap<
  Database,
  { value: string; state: State; calculations: PlannerEnvelope["calculations"] }
>();
export class PlannerService {
  constructor(readonly db: Database) {}
  async current() {
    let row = await this.db.plannerState.findUnique({
      where: { id: "family" },
    });
    if (!row) {
      const legacy = await this.db.document.findUnique({
        where: { namespace_key: { namespace: "planner", key: "state.json" } },
      });
      const state = legacy
        ? hydrateState(JSON.parse(legacy.value), defaults as Plan)
        : freshState(defaults as Plan);
      await this.db.plannerState.upsert({
        where: { id: "family" },
        create: {
          id: "family",
          value: JSON.stringify(state),
          revision: 1,
          commandKind: "bootstrap",
        },
        update: {},
      });
      row = await this.db.plannerState.findUniqueOrThrow({
        where: { id: "family" },
      });
    }
    return row;
  }
  envelope(row: {
    value: string;
    revision: number;
    commandId?: string | null;
    commandKind?: string;
  }): PlannerEnvelope {
    let snapshot = snapshots.get(this.db);
    if (!snapshot || snapshot.value !== row.value) {
      const state = hydrateState(JSON.parse(row.value), defaults as Plan);
      snapshot = {
        value: row.value,
        state,
        calculations: calculatePlanner(state),
      };
      snapshots.set(this.db, snapshot);
    }
    const { state, calculations } = snapshot;
    return {
      state,
      revision: row.revision,
      calculations,
      serverTime: new Date().toISOString(),
      ...(row.commandId
        ? {
            lastCommand: {
              id: row.commandId,
              kind: row.commandKind || "unknown",
            },
          }
        : {}),
    };
  }
  async read() {
    return this.envelope(await this.current());
  }
  async command(body: unknown, actor: string) {
    const request = body as {
      id: string;
      revision: number;
      command: PlannerCommand;
    };
    if (
      !request ||
      !UUID.test(request.id) ||
      !Number.isSafeInteger(request.revision) ||
      request.revision < 1 ||
      !request.command ||
      !COMMANDS.includes(request.command.name)
    )
      throw new ApiError(400, "invalid_command");
    const fingerprint = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(request.command)),
        ),
      ),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const duplicate = await this.db.commandReceipt.findUnique({
      where: { id: request.id },
    });
    if (duplicate) {
      if (
        duplicate.actor !== actor ||
        duplicate.kind !== request.command.name ||
        duplicate.fingerprint !== fingerprint
      )
        throw new ApiError(409, "command_id_conflict");
      return { ...(await this.read()), replayed: true };
    }
    const row = await this.current();
    if (row.revision !== request.revision)
      throw new ApiError(409, "revision_conflict");
    let next: State;
    try {
      let undo: State | undefined;
      if (request.command.name === "state.undo") {
        const version = await this.db.stateVersion.findUnique({
          where: { revision: row.revision - 1 },
        });
        if (version)
          undo = hydrateState(JSON.parse(version.value), defaults as Plan);
      }
      next = executeCommand(
        hydrateState(JSON.parse(row.value), defaults as Plan),
        request.command,
        defaults as Plan,
        undo,
      );
    } catch (error) {
      throw new ApiError(
        400,
        "invalid_operation",
        error instanceof Error ? error.message : "Invalid operation.",
      );
    }
    const value = JSON.stringify(next);
    if (new TextEncoder().encode(value).length > 1_750_000)
      throw new ApiError(413, "state_too_large");
    // One SQL update commits command receipt + version + all report projections via triggers.
    try {
      const updated = await this.db.plannerState.updateMany({
        where: { id: "family", revision: request.revision },
        data: {
          value,
          revision: { increment: 1 },
          commandId: request.id,
          commandKind: request.command.name,
          commandHash: fingerprint,
          actor,
          updatedAt: new Date().toISOString(),
        },
      });
      if (!updated.count) {
        const saved = await this.db.commandReceipt.findUnique({
          where: { id: request.id },
        });
        if (saved?.actor === actor && saved.fingerprint === fingerprint)
          return { ...(await this.read()), replayed: true };
        throw new ApiError(409, "revision_conflict");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const saved = await this.db.commandReceipt.findUnique({
        where: { id: request.id },
      });
      if (saved?.actor === actor && saved.fingerprint === fingerprint)
        return { ...(await this.read()), replayed: true };
      throw error;
    }
    return this.read();
  }
}
