/** Geometry and rule types shared by pure core algorithms and external adapters. */
export interface Interval {
  top: number;
  bottom: number;
}

export interface PageSlice {
  start: number;
  end: number;
}

export type Orientation = 'portrait' | 'landscape';

export type Paper =
  | 'a4'
  | 'a3'
  | 'a5'
  | 'letter'
  // Social media / image frames (pixel-based definition)
  | 'card-3x4'
  | 'square-1x1'
  | 'card-4x5'
  | 'story-9x16'
  | 'ecom-750x1000'
  | 'custom';

/** Declarative header/footer base configuration (configured programmatically) */
export interface DeclarativeHeaderFooterConfig {
  enabled?: boolean;
  text?: string;
  align?: 'left' | 'center' | 'right';
  showDivider?: boolean;
}

/** Standalone page number configuration (controllable via UI settings or programmatically) */
export interface PageNumberConfig {
  enabled: boolean;
  position?: 'bottom-right' | 'bottom-center' | 'top-right' | 'top-center';
  format?: 'slash' | 'chinese' | 'hyphen';
}

export interface PrintSettings {
  paper: Paper;
  unit?: 'mm' | 'px';
  widthMm: number;
  heightMm: number;
  orientation: Orientation;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  header?: DeclarativeHeaderFooterConfig;
  footer?: DeclarativeHeaderFooterConfig;
  pageNumber?: PageNumberConfig;
  /** Starting page number to print (1-based, defaults to 1). */
  startPage?: number;
  /** Ending page number to print (1-based, inclusive, defaults to the last page). */
  endPage?: number;
}

/**
 * Element nodes are classified into atomic and splittable; text nodes are measured separately by the DOM adapter layer.
 */
export type ElementRule =
  | { kind: 'atomic'; label: string }
  | { kind: 'splittable' };

export interface PrintRule {
  selector: string;
  result: ElementRule;
}

export interface PrintRuleConfig {
  /** Selectors for elements that must not be split across pages (errors if exceeding single-page height) */
  atomic?: string[];
  /** Prefer keeping entire element intact when it fits on a single page, but recursively split if oversized. */
  splittable?: string[];

  /** @deprecated Default behavior is recursive analysis; explicit forceSplit is no longer necessary. */
  forceSplit?: string[];

  /** Custom advanced rules (matched with priority, declaring atomic or splittable) */
  customRules?: PrintRule[];
}

export interface MeasurementStats {
  visitedNodes: number;
  atomicElements: number;
  textNodes: number;
  textFragments: number;
}

export interface DocumentMeasurement {
  height: number;
  ranges: Interval[];
  stats?: MeasurementStats;
}
