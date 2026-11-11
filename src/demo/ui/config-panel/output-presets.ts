import { IMAGE_PAPER_SIZES, Paper } from '../../../lib';
import type { Locale } from '../locale';

export interface OutputPresetMeta {
  value: Paper;
  group: '纸张' | '社媒图片' | '其他';
  groupEn: 'Paper' | 'Social Media' | 'Other';
  /** Short name for toolbar */
  name: string;
  nameEn: string;
  /** Dimension details for select dropdown */
  detail: string;
  detailEn: string;
}

/**
 * Single source of truth for output size presets.
 * Shared between toolbar display and settings panel dropdown.
 */
export const OUTPUT_PRESETS: OutputPresetMeta[] = [
  { value: 'a4', group: '纸张', groupEn: 'Paper', name: 'A4', nameEn: 'A4', detail: '210×297 mm', detailEn: '210×297 mm' },
  { value: 'a3', group: '纸张', groupEn: 'Paper', name: 'A3', nameEn: 'A3', detail: '297×420 mm', detailEn: '297×420 mm' },
  { value: 'a5', group: '纸张', groupEn: 'Paper', name: 'A5', nameEn: 'A5', detail: '148×210 mm', detailEn: '148×210 mm' },
  { value: 'letter', group: '纸张', groupEn: 'Paper', name: 'Letter', nameEn: 'Letter', detail: '216×279 mm', detailEn: '216×279 mm' },
  { value: 'card-3x4', group: '社媒图片', groupEn: 'Social Media', name: '小红书 3:4', nameEn: 'Card 3:4', detail: `${IMAGE_PAPER_SIZES['card-3x4'].widthPx}×${IMAGE_PAPER_SIZES['card-3x4'].heightPx}`, detailEn: `${IMAGE_PAPER_SIZES['card-3x4'].widthPx}×${IMAGE_PAPER_SIZES['card-3x4'].heightPx}` },
  { value: 'card-4x5', group: '社媒图片', groupEn: 'Social Media', name: '4:5', nameEn: '4:5', detail: `${IMAGE_PAPER_SIZES['card-4x5'].widthPx}×${IMAGE_PAPER_SIZES['card-4x5'].heightPx}`, detailEn: `${IMAGE_PAPER_SIZES['card-4x5'].widthPx}×${IMAGE_PAPER_SIZES['card-4x5'].heightPx}` },
  { value: 'square-1x1', group: '社媒图片', groupEn: 'Social Media', name: '1:1', nameEn: '1:1', detail: `${IMAGE_PAPER_SIZES['square-1x1'].widthPx}×${IMAGE_PAPER_SIZES['square-1x1'].heightPx}`, detailEn: `${IMAGE_PAPER_SIZES['square-1x1'].widthPx}×${IMAGE_PAPER_SIZES['square-1x1'].heightPx}` },
  { value: 'story-9x16', group: '社媒图片', groupEn: 'Social Media', name: '9:16', nameEn: '9:16', detail: `${IMAGE_PAPER_SIZES['story-9x16'].widthPx}×${IMAGE_PAPER_SIZES['story-9x16'].heightPx}`, detailEn: `${IMAGE_PAPER_SIZES['story-9x16'].widthPx}×${IMAGE_PAPER_SIZES['story-9x16'].heightPx}` },
  { value: 'ecom-750x1000', group: '社媒图片', groupEn: 'Social Media', name: '电商详情', nameEn: 'E-commerce', detail: `${IMAGE_PAPER_SIZES['ecom-750x1000'].widthPx}×${IMAGE_PAPER_SIZES['ecom-750x1000'].heightPx}`, detailEn: `${IMAGE_PAPER_SIZES['ecom-750x1000'].widthPx}×${IMAGE_PAPER_SIZES['ecom-750x1000'].heightPx}` },
  { value: 'custom', group: '其他', groupEn: 'Other', name: '自定义', nameEn: 'Custom', detail: '手动输入宽高', detailEn: 'Manual dimensions' },
];

/** Short name for toolbar, fallback to custom when preset is unknown. */
export function getOutputPresetName(paper: Paper, locale: Locale = 'zh'): string {
  const item = OUTPUT_PRESETS.find(preset => preset.value === paper);
  if (!item) return locale === 'en' ? 'Custom' : '自定义';
  return locale === 'en' ? item.nameEn : item.name;
}

/** Grouped dropdown options for the settings panel. */
export function getOutputPresetOptions(locale: Locale = 'zh') {
  const isEn = locale === 'en';
  const groups = isEn ? (['Paper', 'Social Media', 'Other'] as const) : (['纸张', '社媒图片', '其他'] as const);

  return groups.map(group => ({
    label: group,
    options: OUTPUT_PRESETS.filter(preset => (isEn ? preset.groupEn === group : preset.group === group)).map(preset => ({
      value: preset.value,
      label: `${isEn ? preset.nameEn : preset.name} · ${isEn ? preset.detailEn : preset.detail}`,
    })),
  }));
}

export const OUTPUT_PRESET_OPTIONS = getOutputPresetOptions('zh');
