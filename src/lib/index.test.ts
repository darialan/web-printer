import { useWebPrinter, usePdfPrint } from './react';
import {
  buildHtmlPreviewData,
  calculateGeometry,
  calculateHtmlPaperGeometry,
  clearPageBreaks,
  closePrintPreview,
  DEFAULT_SETTINGS,
  hasPageBreaks,
  outputPDF,
  paginate,
  previewPrint,
  PRINT_ATTRIBUTES,
  PRINT_CLASSES,
  resolvePaper,
  togglePageBreaks,
  visualizePageBreaks,
} from './index';

describe('Web Printer Lib Entry Point', () => {
  it('exports core pagination and geometry functions', () => {
    expect(typeof paginate).toBe('function');
    expect(typeof calculateGeometry).toBe('function');
    expect(typeof resolvePaper).toBe('function');
    expect(DEFAULT_SETTINGS.paper).toBe('a4');
  });

  it('exports attributes and class standards', () => {
    expect(PRINT_ATTRIBUTES.ATOMIC).toContain('data-print-atomic');
    expect(PRINT_ATTRIBUTES.SPLITTABLE).toContain('data-print-splittable');
    expect(PRINT_ATTRIBUTES).not.toHaveProperty('IGNORE');
    expect(PRINT_CLASSES.ATOMIC).toBe('print-atomic');
  });

  it('exports application export service, preview overlay and visual debugger', () => {
    expect(typeof outputPDF).toBe('function');
    expect(typeof previewPrint).toBe('function');
    expect(typeof closePrintPreview).toBe('function');
    expect(typeof buildHtmlPreviewData).toBe('function');
    expect(typeof calculateHtmlPaperGeometry).toBe('function');
    expect(typeof visualizePageBreaks).toBe('function');
    expect(typeof togglePageBreaks).toBe('function');
    expect(typeof clearPageBreaks).toBe('function');
    expect(typeof hasPageBreaks).toBe('function');
    expect(typeof useWebPrinter).toBe('function');
    expect(usePdfPrint).toBe(useWebPrinter);
  });

  it('calculates page slices correctly with paginate', () => {
    // 300px total height, 100px capacity, protected range at [80, 110]
    // The break should retreat from 100 to 80.
    const slices = paginate(300, 100, [{ top: 80, bottom: 110 }]);
    expect(slices.length).toBeGreaterThan(1);
    expect(slices[0].end).toBe(80);
    expect(slices[1].start).toBe(80);
  });
});
