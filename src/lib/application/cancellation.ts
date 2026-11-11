export function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Export was cancelled');
}
