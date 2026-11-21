/** An acknowledgement belongs only to the owner and exact snapshot sent. */
export function droneSyncAcknowledgement(sentOwner: string | null, currentOwner: string | null, sentState: string, currentState: string) {
  return { sameOwner: sentOwner === currentOwner, unchanged: sentState === currentState };
}
