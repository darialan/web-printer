/** Only library-owned debug hosts can be omitted from a whole-document snapshot. */
const debugLayers = new WeakSet<Element>();
export function registerDebugLayer(element: Element): void { debugLayers.add(element); }
export function isDebugLayer(element: Element): boolean { return debugLayers.has(element); }
