// Node-only runtime shim for unit tests. Production uses cloudflare:workers.
export class WorkflowEntrypoint<E> {
  protected env: E;
  constructor(_context: unknown, env: E) {
    this.env = env;
  }
}
