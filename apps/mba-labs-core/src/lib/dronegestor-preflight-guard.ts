/** Reject preflight responses superseded by a newer request or local edit. */
export function createPreflightRequestGuard(readSignature: () => string) {
  let generation = 0;
  return {
    begin(signature: string) { return { generation: ++generation, signature }; },
    invalidate() { generation += 1; },
    isCurrent(ticket: { generation: number; signature: string }) {
      return ticket.generation === generation && ticket.signature === readSignature();
    },
  };
}
