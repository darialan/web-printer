import { Interval, PageSlice } from '../types';
export type { Interval, PageSlice } from '../types';

/** CSS-pixel intervals relative to the print root. No DOM or UI dependencies. */
export function paginate(height: number, capacity: number, protectedRanges: Interval[], maxPages = 100): PageSlice[] {
  if (![height, capacity].every(Number.isFinite) || height <= 0 || capacity <= 0 || !Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new Error('Invalid print area or paper dimensions');
  }
  // Merge overlapping protections once. Repeatedly scanning every line for every
  // page used to be quadratic for overlapping inline text fragments.
  const ranges: Interval[] = [];
  const sorted = protectedRanges.map(range => {
    if (!Number.isFinite(range.top) || !Number.isFinite(range.bottom) || range.bottom < range.top) {
      throw new Error('Invalid pagination measurement result');
    }
    return { top: Math.max(0, range.top), bottom: Math.min(height, range.bottom) };
  }).filter(range => range.bottom > range.top).sort((a, b) => a.top - b.top);
  for (const range of sorted) {
    if (range.bottom - range.top > capacity) {
      throw new Error('Content exceeds single-page height and cannot be split. Please reduce element size or adjust layout.');
    }
    const previous = ranges[ranges.length - 1];
    if (previous && range.top < previous.bottom) previous.bottom = Math.max(previous.bottom, range.bottom);
    else ranges.push({ ...range });
  }
  if (ranges.some(range => range.bottom - range.top > capacity)) {
    throw new Error('Overlapping atomic content exceeds single-page height, unable to paginate safely.');
  }
  const pages: PageSlice[] = [];
  let start = 0;
  let cursor = 0;
  while (start < height) {
    if (pages.length >= maxPages) throw new Error(`Document exceeds maximum limit of ${maxPages} pages. Please split content or increase page height.`);
    let end = Math.min(start + capacity, height);
    if (end < height) {
      while (cursor < ranges.length && ranges[cursor].bottom <= end) cursor++;
      if (cursor < ranges.length && ranges[cursor].top < end) end = ranges[cursor].top;
    }
    // A padding-only tail can otherwise create an unexpected blank final page.
    // Retreat to the last protected block/line when both slices still advance
    // and fit. Coverage is unchanged and all breakpoints remain legal.
    const last = ranges[ranges.length - 1];
    if (end < height && last && last.bottom <= end && last.top > start &&
        last.top < end && height - last.top <= capacity) {
      end = last.top;
    }
    if (end <= start) throw new Error('Available page height is too small for safe pagination. Please increase page height.');
    pages.push({ start, end });
    start = end;
  }
  return pages;
}

/** Verify that planned page breaks do not cut through protected intervals. */
export function validatePageBreaks(pages: PageSlice[], ranges: Interval[], tolerance = 0.25) {
  const intersections = pages.slice(1).filter(page => ranges.some(range =>
    range.top + tolerance < page.start && range.bottom - tolerance > page.start));
  if (intersections.length) {
    throw new Error(`Pagination preview deviates from original layout: ${intersections.length} breakpoints intersect protected content, first at ${intersections[0].start.toFixed(1)}px`);
  }
}

/** 解析并校验后的目标打印页码区间信息 */
export interface ResolvedPageRange {
  /** 1-based 起始打印页码（从 1 开始） */
  startPage: number;
  /** 1-based 结尾打印页码（包含该页） */
  endPage: number;
  /** 实际打印的总页数 */
  count: number;
  /** 对应的切片索引起始值（0-based，闭区间起） */
  startIndex: number;
  /** 对应的切片索引结束值（0-based，闭区间止） */
  endIndex: number;
}

/**
 * 校验并解析目标打印页码范围（1-based）。
 * 默认从第一页打到最后一页（startPage = 1, endPage = totalPages）。
 */
export function resolvePageRange(
  totalCount: number,
  startPage?: number,
  endPage?: number
): ResolvedPageRange {
  if (!Number.isInteger(totalCount) || totalCount < 1) {
    throw new Error('文档总页数无效');
  }

  const start = startPage !== undefined && startPage !== null ? Number(startPage) : 1;
  const end = endPage !== undefined && endPage !== null ? Number(endPage) : totalCount;

  if (!Number.isInteger(start) || start < 1) {
    throw new Error(`起始打印页码必须为大于或等于 1 的整数，当前为: ${startPage}`);
  }
  if (!Number.isInteger(end) || end < 1) {
    throw new Error(`结尾打印页码必须为大于或等于 1 的整数，当前为: ${endPage}`);
  }
  if (start > totalCount) {
    throw new Error(`起始打印页码 (${start}) 超出文档总页数 (${totalCount})`);
  }
  if (start > end) {
    throw new Error(`起始打印页码 (${start}) 不能大于结尾打印页码 (${end})`);
  }

  // 结尾页码超出总页数时自动截断至最后一页
  const clampedEnd = Math.min(end, totalCount);
  const count = clampedEnd - start + 1;

  return {
    startPage: start,
    endPage: clampedEnd,
    count,
    startIndex: start - 1,
    endIndex: clampedEnd - 1,
  };
}
