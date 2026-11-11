import { createPdfWriter } from '../adapters/pdf/jspdf-writer';
import { createImageWriter } from './image-writer';
import { OutputFormat, OutputWriter, OutputWriterOptions } from './types';
export * from './types';

const writerFactories: Record<OutputFormat, (options: OutputWriterOptions) => OutputWriter | Promise<OutputWriter>> = {
  pdf: createPdfWriter,
  png: createImageWriter,
};

export function validateOutputFormat(format: OutputFormat): void {
  if (!Object.prototype.hasOwnProperty.call(writerFactories, format)) throw new Error(`Unsupported output format: ${format}`);
}

export function createOutputWriter(format: OutputFormat, options: OutputWriterOptions): Promise<OutputWriter> | OutputWriter {
  validateOutputFormat(format);
  return writerFactories[format](options);
}
