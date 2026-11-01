import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { runMenuJob } from "../api/menu-job";
import { workerDatabase } from "../api/worker-database";
import { prismaD1Gateway } from "../api/database";
import type { Env } from "./types";
export class MenuWorkflow extends WorkflowEntrypoint<Env, { id: string }> {
  async run(event: WorkflowEvent<{ id: string }>, step: WorkflowStep) {
    const env =
      this.env.PERSISTENCE_MODE === "prisma"
        ? { ...this.env, DB: prismaD1Gateway(workerDatabase(this.env.DB)) }
        : this.env;
    return runMenuJob(env, event, step);
  }
}
