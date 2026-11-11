import { assertNoLegacyIgnore, isDisplaySuppressed, isPaintVisible } from '../dom/visibility';
import { checkCancelled } from '../../application/cancellation';
import { assertSupportedRules, getPrintRules } from '../../core/rules/print-rules';
import { PrintRule } from '../../core/types';

async function settleLayout(signal?: AbortSignal) {
  // Font/image readiness resolves before the next browser layout pass. Timers also
  // settle when the tab is backgrounded, unlike an unbounded requestAnimationFrame.
  for (let i = 0; i < 2; i++) {
    checkCancelled(signal);
    await new Promise(resolve => setTimeout(resolve, 16));
  }
  checkCancelled(signal);
}

export async function waitForResources(host: HTMLElement, signal?: AbortSignal, rules: readonly PrintRule[] = getPrintRules(), excludedElements: readonly Element[] = []) {
  checkCancelled(signal);
  assertSupportedRules(rules);
  assertNoLegacyIgnore(host);
  let timeout: ReturnType<typeof setTimeout>;
  let abort = () => {};
  const guard = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Font or image loading timed out, please try again later')), 15000);
    abort = () => reject(new Error('Export was cancelled'));
    signal?.addEventListener('abort', abort, { once: true });
  });
  try {
    await Promise.race([guard, (async () => {
      await Promise.all([
        host.ownerDocument.fonts?.ready,
        ...[...(host.tagName === 'IMG' ? [host as HTMLImageElement] : []), ...Array.from(host.querySelectorAll('img'))].filter(img => {
          // Source readiness must not wait on explicitly excluded resources.
          for (let node: Element | null = img; node; node = node.parentElement) {
            if (excludedElements.includes(node) || isDisplaySuppressed(node)) return false;
            if (node === host) break;
          }
          return isPaintVisible(img);
        }).map(async img => {
          try { await img.decode(); }
          catch { throw new Error(`Failed to load image: ${img.alt || 'unnamed image'}`); }
          if (!img.naturalWidth) throw new Error(`Image content is empty: ${img.alt || 'unnamed image'}`);
        }),
      ]);
      await settleLayout(signal);
    })()]);
    checkCancelled(signal);
  } finally {
    clearTimeout(timeout!);
    signal?.removeEventListener('abort', abort);
  }
}
