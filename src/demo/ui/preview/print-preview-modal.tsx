import {
  buildHtmlPreviewData,
  calculateHtmlPaperGeometry,
  HtmlPaperGeometry,
  HtmlPreviewData,
  namespacePreviewHtml,
  PageSlice,
} from '../../../lib';
import { Button, Modal, Spin, Tag } from 'antd';
import React, { useId, useMemo, useState } from 'react';
import './print-preview-modal.css';

export { buildHtmlPreviewData, calculateHtmlPaperGeometry };
export type { HtmlPaperGeometry, HtmlPreviewData };

export interface PrintPreviewModalProps {
  open: boolean;
  loading?: boolean;
  previewData?: HtmlPreviewData | null;
  onClose: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
}

export function PrintPreviewModal({
  open,
  loading = false,
  previewData,
  onClose,
  onExport,
  onRefresh,
}: PrintPreviewModalProps) {
  const [zoom, setZoom] = useState(0.85);

  const handleZoomIn = () => setZoom(prev => Math.min(1.5, Number((prev + 0.1).toFixed(2))));
  const handleZoomOut = () => setZoom(prev => Math.max(0.4, Number((prev - 0.1).toFixed(2))));
  const handleZoomReset = () => setZoom(0.85);

  return (
    <Modal
      className="print-preview-modal"
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      style={{ maxWidth: 1360, top: 16 }}
      destroyOnClose={false}
      closable={false}
    >
      <div className="print-preview-header">
        <div className="print-preview-title-area">
          <span className="print-preview-title">📄 打印效果预览 (HTML 虚拟纸张)</span>
          <div className="print-preview-tags">
            {previewData?.paperLabel && (
              <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                {previewData.paperLabel}
              </Tag>
            )}
            {previewData && (
              <>
                <Tag style={{ margin: 0, fontSize: 11 }}>共 {previewData.pages.length} 页</Tag>
                <Tag style={{ margin: 0, fontSize: 11 }}>即时渲染: {previewData.totalMs.toFixed(0)}ms</Tag>
              </>
            )}
          </div>
        </div>

        {/* 缩放控制器 */}
        <div className="print-preview-center-controls">
          <Button size="small" type="text" onClick={handleZoomOut} disabled={zoom <= 0.4}>
            －
          </Button>
          <span className="print-preview-zoom-text">{Math.round(zoom * 100)}%</span>
          <Button size="small" type="text" onClick={handleZoomIn} disabled={zoom >= 1.5}>
            ＋
          </Button>
          <Button size="small" type="link" onClick={handleZoomReset} style={{ fontSize: 11, padding: '0 4px' }}>
            适应
          </Button>
        </div>

        <div className="print-preview-actions">
          {onRefresh && (
            <Button size="small" onClick={onRefresh} disabled={loading}>
              🔄 重新排版
            </Button>
          )}
          {onExport && (
            <Button size="small" type="primary" onClick={onExport} disabled={loading}>
              ⬇️ 导出真实 PDF
            </Button>
          )}
          <Button size="small" onClick={onClose}>
            ✕ 关闭
          </Button>
        </div>
      </div>

      <div className="html-preview-workspace">
        {loading && (
          <div className="print-preview-loading">
            <Spin size="large" />
            <div className="print-preview-loading-text">正在计算物理纸张排版与切片视窗…</div>
          </div>
        )}

        {previewData && previewData.pages.length > 0 ? (
          previewData.pages.map((page, index) => (
            <HtmlPageSheet
              key={index}
              pageIndex={index}
              totalPages={previewData.pages.length}
              page={page}
              geometry={previewData.geometry}
              sourceHtml={previewData.sourceHtml}
              headerHtml={previewData.headerHtml}
              footerHtml={previewData.footerHtml}
              zoom={zoom}
            />
          ))
        ) : (
          !loading && (
            <div className="print-preview-empty">
              <span>暂无预览数据</span>
              {onRefresh && (
                <Button type="primary" size="small" onClick={onRefresh}>
                  重新生成
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </Modal>
  );
}

export function HtmlPageSheet({
  pageIndex,
  totalPages,
  page,
  geometry,
  sourceHtml,
  headerHtml,
  footerHtml,
  zoom,
}: {
  pageIndex: number;
  totalPages: number;
  page: PageSlice;
  geometry: HtmlPaperGeometry;
  sourceHtml: string;
  headerHtml?: string;
  footerHtml?: string;
  zoom: number;
}) {
  const {
    paperWidthPx,
    paperHeightPx,
    marginTopPx,
    marginRightPx,
    marginBottomPx,
    marginLeftPx,
    printableWidthPx,
    headerHeightPx,
    footerHeightPx,
    sourceWidth,
    scale,
    pageNumber, bodyTopPx = marginTopPx + headerHeightPx,
    footerTopPx = paperHeightPx - marginBottomPx - footerHeightPx,
    pageNumberYPx = paperHeightPx - marginBottomPx / 2,
  } = geometry;

  const id = useId().replace(/:/g, '');
  const sourceMarkup = useMemo(() => namespacePreviewHtml(sourceHtml, `sheet-${id}-body`), [sourceHtml, id]);
  const headerMarkup = useMemo(() => namespacePreviewHtml(headerHtml || '', `sheet-${id}-header`), [headerHtml, id]);
  const footerMarkup = useMemo(() => namespacePreviewHtml(footerHtml || '', `sheet-${id}-footer`), [footerHtml, id]);
  const sliceHeightPx = (page.end - page.start) * scale;
  const showPageNumber = pageNumber?.enabled !== false;
  const pageNumberText =
    pageNumber?.format === 'chinese'
      ? `第 ${pageIndex + 1} 页 / 共 ${totalPages} 页`
      : pageNumber?.format === 'hyphen'
      ? `- ${pageIndex + 1} -`
      : `${pageIndex + 1} / ${totalPages}`;
  const isCenter = pageNumber?.position === 'bottom-center' || pageNumber?.position === 'top-center';

  return (
    <div className="html-page-sheet-container">
      <div className="html-page-sheet-header-badge">
        第 {pageIndex + 1} 页 / 共 {totalPages} 页 · 切片高度 {Math.round(page.end - page.start)}px
      </div>

      <div
        className="html-page-sheet"
        style={{
          width: paperWidthPx * zoom,
          height: paperHeightPx * zoom,
          padding: `${marginTopPx * zoom}px ${marginRightPx * zoom}px ${marginBottomPx * zoom}px ${marginLeftPx * zoom}px`,
        }}
      >
        {/* 页眉 */}
        {headerHtml && (
          <div
            className="html-sheet-header-box"
            style={{
              position: 'absolute', top: marginTopPx * zoom,
              height: headerHeightPx * zoom,
              width: printableWidthPx * zoom,
            }}
          >
            <div
              style={{
                width: sourceWidth,
                transform: `scale(${scale * zoom})`,
                transformOrigin: 'top left',
              }}
              dangerouslySetInnerHTML={{ __html: headerMarkup }}
            />
          </div>
        )}

        {/* 正文切片视窗 */}
        <div
          className="html-sheet-body-viewport"
          style={{
            width: printableWidthPx * zoom,
            position: 'absolute', top: bodyTopPx * zoom,
            height: sliceHeightPx * zoom,
            maxHeight: sliceHeightPx * zoom,
          }}
        >
          <div
            className="html-sheet-body-content"
            style={{
              width: sourceWidth,
              transform: `scale(${scale * zoom}) translateY(-${page.start}px)`,
              transformOrigin: 'top left',
            }}
            dangerouslySetInnerHTML={{ __html: sourceMarkup }}
          />
        </div>

        {/* 页脚 */}
        {footerHtml && (
          <div
            className="html-sheet-footer-box"
            style={{
              position: 'absolute', top: footerTopPx * zoom,
              height: footerHeightPx * zoom,
              width: printableWidthPx * zoom,
            }}
          >
            <div
              style={{
                width: sourceWidth,
                transform: `scale(${scale * zoom})`,
                transformOrigin: 'top left',
              }}
              dangerouslySetInnerHTML={{ __html: footerMarkup }}
            />
          </div>
        )}

        {/* 页码 */}
        {showPageNumber && (
          <div
            className="html-sheet-page-number"
            style={{
              ...(isCenter
                ? { left: '50%', transform: 'translateX(-50%)' }
                : { right: marginRightPx * zoom }),
              top: (pageNumberYPx - 12) * zoom,
              fontSize: 12 * zoom,
              lineHeight: 1,
            }}
          >
            {pageNumberText}
          </div>
        )}
      </div>
    </div>
  );
}
