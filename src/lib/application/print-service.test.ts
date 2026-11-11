import { measureDocument } from '../adapters/dom/measurement';
import { createPageCapture } from '../adapters/canvas/page-capture';
import { createOutputWriter } from '../output';
import { prepareLayout } from './print-pipeline';
import { calculatePagesArray, exportPreparedLayout } from './print-service';

jest.mock('jspdf', () => jest.fn());
jest.mock('./print-pipeline', () => ({
  prepareLayout: jest.fn(),
  resolvePrintElement: jest.fn((el: any) => el),
}));
jest.mock('../adapters/dom/measurement', () => ({ measureDocument: jest.fn() }));
jest.mock('../adapters/canvas/page-capture');
jest.mock('../output');

test('preview tolerates subpixel boundary rounding but rejects actual intersections and cleans up', async () => {
  const cleanup = jest.fn();
  const source = document.createElement('div');
  (measureDocument as jest.Mock).mockReturnValue({ ranges: [{ top: 100, bottom: 150 }] });
  (prepareLayout as jest.Mock).mockResolvedValue({
    pages: [
      { start: 0, end: 100.04 },
      { start: 100.04, end: 200 },
    ],
    capacity: 200,
    cleanup,
  });
  await expect(calculatePagesArray({ contentElement: source })).resolves.toEqual([0, 100.04]);

  (prepareLayout as jest.Mock).mockResolvedValue({
    pages: [
      { start: 0, end: 107 },
      { start: 107, end: 200 },
    ],
    capacity: 200,
    cleanup,
  });
  await expect(calculatePagesArray({ contentElement: source })).rejects.toThrow('intersect protected content');
  expect(cleanup).toHaveBeenCalledTimes(2);
});

test('exportPreparedLayout selectively renders only pages within startPage and endPage', async () => {
  const dummyCanvas = document.createElement('canvas');
  const captureMock = jest.fn().mockResolvedValue(dummyCanvas);
  const releaseMock = jest.fn();
  (createPageCapture as jest.Mock).mockReturnValue({
    capture: captureMock,
    release: releaseMock,
    dispose: jest.fn(),
    timings: [],
  });

  const addPageSliceMock = jest.fn().mockResolvedValue(undefined);
  const finalizeMock = jest.fn().mockResolvedValue(new Blob(['pdf-content']));
  (createOutputWriter as jest.Mock).mockResolvedValue({
    addPageSlice: addPageSliceMock,
    finalize: finalizeMock,
  });

  const layout: any = {
    root: document.createElement('div'),
    width: 800,
    headerHeight: 0,
    footerHeight: 0,
    ratio: 1,
    pages: [
      { start: 0, end: 100 },
      { start: 100, end: 200 },
      { start: 200, end: 300 },
      { start: 300, end: 400 },
      { start: 400, end: 500 },
    ],
    cleanup: jest.fn(),
  };

  const onProgress = jest.fn();

  // Test 1: Export only page 2 to page 4 (3 pages total)
  const result = await exportPreparedLayout(layout, {
    filename: 'partial.pdf',
    download: false,
    format: 'pdf',
    startPage: 2,
    endPage: 4,
    onProgress,
  });

  expect(createOutputWriter).toHaveBeenCalledWith('pdf', expect.objectContaining({
    totalPages: 3,
  }));
  // Only pages[1], pages[2], pages[3] should be captured
  expect(captureMock).toHaveBeenCalledTimes(3);
  expect(captureMock).toHaveBeenNthCalledWith(1, layout.root, 100, 100);
  expect(captureMock).toHaveBeenNthCalledWith(2, layout.root, 200, 100);
  expect(captureMock).toHaveBeenNthCalledWith(3, layout.root, 300, 100);

  expect(addPageSliceMock).toHaveBeenCalledTimes(3);
  expect(result.pages).toBe(3);
  expect(onProgress).toHaveBeenNthCalledWith(1, 0, 3);
  expect(onProgress).toHaveBeenLastCalledWith(3, 3);

  // Test 2: Reject startPage exceeding total pages
  await expect(exportPreparedLayout(layout, {
    filename: 'invalid.pdf',
    format: 'pdf',
    startPage: 6,
  })).rejects.toThrow('exceeds total page count');
});
