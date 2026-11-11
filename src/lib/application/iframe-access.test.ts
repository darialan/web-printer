import { resolvePrintElement } from './print-pipeline';

function frameWith(doc: Partial<Document> | null, blocked = false) {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  Object.defineProperty(frame, 'contentDocument', { configurable: true, get: () => doc });
  if (blocked) Object.defineProperty(frame, 'contentWindow', { configurable: true, get: () => { throw new DOMException('Blocked by same origin policy', 'SecurityError'); } });
  return frame;
}

afterEach(() => { document.body.innerHTML = ''; });

test('cross-origin iframe produces an actionable error instead of an uncaught SecurityError or empty export', () => {
  const frame = frameWith(null, true);
  expect(() => resolvePrintElement(frame)).toThrow('cross-origin iframe');
});

test('loading iframe cannot be exported as an empty frame', () => {
  const frame = frameWith({ body: document.body, readyState: 'loading' });
  expect(() => resolvePrintElement(frame)).toThrow('not ready yet');
});

test('loaded same-origin iframe resolves only its marked business content', () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = '<header>Portal Nav</header><main id="iframe-report-content"><h1>Vendor Statement</h1></main>';
  document.body.appendChild(wrapper);
  const frame = frameWith({ body: wrapper, readyState: 'complete', getElementById: id => wrapper.querySelector(`#${id}`) });
  expect(resolvePrintElement(frame)?.textContent).toBe('Vendor Statement');
});

test('loaded empty iframe cannot silently export a blank PDF', () => {
  const wrapper = document.createElement('div');
  document.body.appendChild(wrapper);
  const frame = frameWith({ body: wrapper, readyState: 'complete', getElementById: () => null });
  expect(() => resolvePrintElement(frame)).toThrow('No printable business content');
});
