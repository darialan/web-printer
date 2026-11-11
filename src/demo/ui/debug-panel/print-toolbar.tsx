import {
  ObservabilityStats,
  OutputFormat,
  PrintInspectionResult,
  PrintSettings,
  resolvePaper,
} from '../../../lib';
import { Button, Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { cloneElement } from 'react';
import { PrintSettingsButton } from '../config-panel/settings-panel';
import { getOutputPresetName } from '../config-panel/output-presets';
import { demoCopy, Locale, useLocale } from '../locale';
import './print-toolbar.css';

export interface PrintToolbarActionsProps {
  outputFormat?: OutputFormat;
  onOutputFormatChange?: (format: OutputFormat) => void;
  ready?: boolean;
  progress?: string;
  previewOpen?: boolean;
  onOpenPreview?: () => void;
  onTogglePreview?: () => void;
  loading: boolean;
  exporting: boolean;
  settings: PrintSettings;
  debugActive: boolean;
  onExport: () => void;
  onToggleDebug: () => void;
  onCancelExport: () => void;
  onSettingsChange: (next: PrintSettings) => void;
  locale?: Locale;
}

export function PrintToolbarActions({
  outputFormat = 'pdf', onOutputFormatChange,
  ready = true, progress, previewOpen = false, onOpenPreview, onTogglePreview,
  loading,
  exporting,
  settings,
  debugActive,
  onExport,
  onToggleDebug,
  onCancelExport,
  onSettingsChange,
  locale: propLocale,
}: PrintToolbarActionsProps) {
  const [activeLocale] = useLocale();
  const locale = propLocale || activeLocale;
  const t = demoCopy[locale];

  const paper = resolvePaper(settings);
  const unitFactor = settings.unit === 'px' ? 96 / 25.4 : 1;
  const displayWidth = Number((paper.widthMm * unitFactor).toFixed(1));
  const displayHeight = Number((paper.heightMm * unitFactor).toFixed(1));

  const paperName = getOutputPresetName(settings.paper, locale);
  const paperSize = `${displayWidth} × ${displayHeight} ${settings.unit || 'mm'}`;

  return (
    <div className="print-tab-bar-extra">
      {/* Meta info area: read-only document context */}
      <div className="print-toolbar-meta" aria-label={t.specsLabel}>
        <svg className="print-meta-icon" width="13" height="13" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <path d="M4 1.5h5L13 5.5v9H4z" strokeLinejoin="round" />
          <path d="M9 1.5v4h4" strokeLinejoin="round" />
        </svg>
        <span className="print-meta-label">{t.sizeLabel}</span>
        <span className="print-meta-value">{paperName}</span>
        <span className="print-meta-dim">{paperSize}</span>
      </div>

      <span className="print-toolbar-divider" aria-hidden="true" />

      {/* Action area: consolidates into task status during export */}
      <div className="print-toolbar-actions">
        {exporting ? (
          <div className="print-export-task" role="status" aria-live="polite">
            <span className="print-export-spinner" aria-hidden="true" />
            <span className="print-export-task-text">{progress || t.exporting}</span>
            <Button type="text" size="small" danger onClick={onCancelExport}>{t.cancelExport}</Button>
          </div>
        ) : (
          <>
            <div className="print-toolbar-group">
              <PrintSettingsButton value={settings} disabled={loading} onChange={onSettingsChange} locale={locale} />

              <Button
                type={debugActive ? 'primary' : 'default'}
                ghost={debugActive}
                onClick={onToggleDebug}
                disabled={loading || !ready}
                aria-pressed={debugActive}
              >
                {t.pageBreaks}
              </Button>

              <Button
                type={previewOpen ? 'primary' : 'default'}
                ghost={previewOpen}
                onClick={onTogglePreview || onOpenPreview}
                disabled={loading || !ready}
                aria-pressed={previewOpen}
              >
                {t.paperPreview}
              </Button>
            </div>
            {onOutputFormatChange ? (
              <Dropdown.Button
                className="print-export-control"
                overlayClassName="print-export-menu"
                type="primary"
                disabled={!ready || loading}
                trigger={['click']}
                placement="bottomRight"
                icon={<DownOutlined />}
                onClick={onExport}
                buttonsRender={([action, toggle]) => [action, cloneElement(toggle as React.ReactElement, {
                  'aria-label': t.exportFormatSelect,
                })]}
                menu={{
                  selectable: true,
                  selectedKeys: [outputFormat],
                  items: [
                    { key: 'pdf', label: t.formatPdf },
                    { key: 'png', label: t.formatPng },
                  ],
                  onClick: ({ key }) => onOutputFormatChange(key as OutputFormat),
                }}
              >
                {outputFormat === 'pdf' ? t.exportPdf : t.exportPng}
              </Dropdown.Button>
            ) : (
              <Button type="primary" onClick={onExport} disabled={!ready || loading}>{t.exportPdf}</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export interface PrintObservabilityBannerProps {
  inspection: PrintInspectionResult | null;
  stats?: ObservabilityStats;
  onClose?: () => void;
  locale?: Locale;
}

export function PrintObservabilityBanner({
  inspection,
  stats,
  onClose,
  locale: propLocale,
}: PrintObservabilityBannerProps) {
  const [activeLocale] = useLocale();
  const locale = propLocale || activeLocale;
  const t = demoCopy[locale];

  if (!inspection) return null;

  return (
    <div className="print-observability-panel">
      <div className="observability-metrics">
        <span>
          {t.totalPages}: <strong>{inspection.pages.length} {t.pagesUnit}</strong>
        </span>
        <span style={{ color: 'var(--line, #cbd5e1)' }}>•</span>
        <span>
          {locale === 'zh' ? '每页正文高度' : 'Page Height'}: <strong>{Math.round(inspection.capacity)}px</strong>
        </span>
        <span style={{ color: 'var(--line, #cbd5e1)' }}>•</span>
        <span>
          {locale === 'zh' ? '标记耗时' : 'Marking'}: <strong>{inspection.timing.totalMs.toFixed(1)}ms</strong>
        </span>
      </div>

      <div className="observability-legend">
        <span className="legend-item legend-item-keep">
          <span className="legend-dot" style={{ background: '#ef4444' }} />
          atomic: {stats?.atomic ?? 0}
        </span>
        <span className="legend-item legend-item-break">
          <span className="legend-dot" style={{ background: '#3b82f6' }} />
          splittable: {stats?.splittable ?? 0}
        </span>
        <span className="legend-item legend-item-line">
          ✂️ page-break
        </span>
        {(stats?.excluded ?? 0) > 0 && <span className="legend-item legend-item-excluded">excluded: {stats?.excluded}</span>}
        {onClose && (
          <button
            type="button"
            className="observability-close-btn"
            onClick={onClose}
            title={t.exitInspection}
            aria-label={t.exitInspection}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// Backward compatible export
export interface PrintDebugToolbarProps {
  loading: boolean;
  settings: PrintSettings;
  progress: string;
  report: string;
  onExport: () => void;
  onInspect: () => void;
  onCancel: () => void;
  onSettingsChange: (next: PrintSettings) => void;
  locale?: Locale;
}

export function PrintDebugToolbar({
  loading,
  settings,
  progress,
  report,
  onExport,
  onInspect,
  onCancel,
  onSettingsChange,
  locale,
}: PrintDebugToolbarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <PrintToolbarActions
        loading={loading}
        exporting={loading}
        settings={settings}
        debugActive={false}
        onExport={onExport}
        onToggleDebug={onInspect}
        onCancelExport={onCancel}
        onSettingsChange={onSettingsChange}
        locale={locale}
      />
      <span role="status" style={{ color: '#64748b', fontSize: 12 }}>
        {progress || report}
      </span>
    </div>
  );
}
