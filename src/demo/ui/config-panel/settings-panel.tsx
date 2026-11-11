import {
  DEFAULT_SETTINGS,
  getPresetDimensions,
  getPresetUnit,
  MM_PER_PX,
  PrintSettings,
  PX_PER_MM,
  resolvePaper,
  UNIT_FIELDS,
} from '../../../lib';
import { Button, Form, InputNumber, Modal, Radio, Select, Switch } from 'antd';
import { useState } from 'react';
import { getOutputPresetOptions } from './output-presets';
import { demoCopy, Locale, useLocale } from '../locale';
import './settings-panel.css';

const formatDisplayNumber = (val: number | string | undefined) => {
  if (val === undefined || val === '') return '';
  const num = Number(val);
  return Number.isFinite(num) ? String(Number(num.toFixed(2))) : String(val);
};

export function PrintSettingsButton({
  value,
  disabled,
  onChange,
  locale: propLocale,
}: {
  value: PrintSettings;
  disabled: boolean;
  onChange: (next: PrintSettings) => void;
  locale?: Locale;
}) {
  const [activeLocale] = useLocale();
  const locale = propLocale || activeLocale;
  const t = demoCopy[locale];
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<PrintSettings>();
  const paper = Form.useWatch('paper', form);
  const unit = Form.useWatch('unit', form) || 'mm';

  const numberRules = [{ required: true, type: 'number' as const, message: t.numberRequired }];

  const fill = (settings: PrintSettings) => {
    const activeUnit = settings.unit || 'mm';
    const factor = activeUnit === 'px' ? PX_PER_MM : 1;
    const precision = activeUnit === 'px' ? 1 : 2;

    const pageNumber = settings.pageNumber || {
      enabled: true,
      position: 'bottom-right',
      format: 'slash',
    };

    const displayValues: PrintSettings = {
      ...settings,
      unit: activeUnit,
      widthMm: Number((settings.widthMm * factor).toFixed(precision)),
      heightMm: Number((settings.heightMm * factor).toFixed(precision)),
      marginTopMm: Number((settings.marginTopMm * factor).toFixed(precision)),
      marginRightMm: Number((settings.marginRightMm * factor).toFixed(precision)),
      marginBottomMm: Number((settings.marginBottomMm * factor).toFixed(precision)),
      marginLeftMm: Number((settings.marginLeftMm * factor).toFixed(precision)),
      pageNumber,
    };
    form.setFieldsValue(displayValues);
  };

  const apply = async () => {
    try {
      const draft = await form.validateFields();
      const activeUnit = draft.unit || 'mm';
      const factor = activeUnit === 'px' ? MM_PER_PX : 1;

      // Convert to canonical millimeter (mm) units stored in the system core
      const canonical: PrintSettings = {
        ...draft,
        orientation: draft.orientation || value.orientation || 'portrait',
        unit: activeUnit,
        widthMm: Number((draft.widthMm * factor).toFixed(4)),
        heightMm: Number((draft.heightMm * factor).toFixed(4)),
        marginTopMm: Number((draft.marginTopMm * factor).toFixed(4)),
        marginRightMm: Number((draft.marginRightMm * factor).toFixed(4)),
        marginBottomMm: Number((draft.marginBottomMm * factor).toFixed(4)),
        marginLeftMm: Number((draft.marginLeftMm * factor).toFixed(4)),
        header: value.header,
        footer: value.footer,
        pageNumber: {
          enabled: draft.pageNumber?.enabled ?? true,
          position: draft.pageNumber?.position || 'bottom-right',
          format: draft.pageNumber?.format || 'slash',
        },
      };

      resolvePaper(canonical);
      onChange(canonical);
      setOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        form.setFields([{ name: 'paper', errors: [error.message] }]);
      }
    }
  };

  const handleValuesChange = (changed: Partial<PrintSettings>, allValues: PrintSettings) => {
    const currentUnit = allValues.unit || 'mm';

    // 1. Size unit switch (mm <-> px): convert all dimension values losslessly
    if (changed.unit) {
      const toUnit = changed.unit;
      const factor = toUnit === 'px' ? PX_PER_MM : MM_PER_PX;
      const precision = toUnit === 'px' ? 1 : 2;

      const updated: Partial<PrintSettings> = {};
      UNIT_FIELDS.forEach(field => {
        const val = allValues[field];
        if (typeof val === 'number') updated[field] = Number((val * factor).toFixed(precision));
      });
      form.setFieldsValue(updated);
      return;
    }

    // 2. Output preset switch: load preset width, height, and margins, and adapt unit
    if (changed.paper) {
      const nextUnit = changed.paper === 'custom' ? currentUnit : getPresetUnit(changed.paper);
      const preset = getPresetDimensions(changed.paper, allValues.orientation, nextUnit);
      form.setFieldsValue({
        unit: nextUnit,
        widthMm: preset.width,
        heightMm: preset.height,
        marginTopMm: preset.marginTop,
        marginRightMm: preset.marginRight,
        marginBottomMm: preset.marginBottom,
        marginLeftMm: preset.marginLeft,
      });
      return;
    }

    // 3. Paper orientation switch: standard presets swap dimensions, custom sizes stay manual
    if (changed.orientation && allValues.paper !== 'custom') {
      const preset = getPresetDimensions(allValues.paper, changed.orientation, currentUnit);
      form.setFieldsValue({
        widthMm: preset.width,
        heightMm: preset.height,
      });
    }
  };

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          fill(value);
          setOpen(true);
        }}
      >
        {t.settingsBtn}
      </Button>
      <Modal
        className="print-settings-dialog"
        centered
        width={560}
        title={t.settingsTitle}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={apply}
        okText={t.apply}
        cancelText={t.cancel}
        forceRender
        footer={(_, { OkBtn, CancelBtn }) => (
          <>
            <Button
              onClick={() => {
                form.resetFields();
                fill(DEFAULT_SETTINGS);
              }}
            >
              {t.resetDefaults}
            </Button>
            <CancelBtn />
            <OkBtn />
          </>
        )}
      >
        <Form
          form={form}
          preserve={true}
          layout="vertical"
          initialValues={value}
          onValuesChange={handleValuesChange}
        >
          {/* Unit and paper size define how following values are interpreted */}
          <div className="print-settings-grid print-settings-grid--head">
            <Form.Item name="unit" label={t.unitLabel}>
              <Radio.Group options={[{ value: 'mm', label: 'mm' }, { value: 'px', label: 'px' }]} />
            </Form.Item>
            <Form.Item name="paper" label={t.paperLabel} rules={[{ required: true }]}>
              <Select options={getOutputPresetOptions(locale)} popupMatchSelectWidth={false} />
            </Form.Item>
          </div>
          {/* Width and height are paired with orientation */}
          <div className="print-settings-grid print-settings-grid--dims">
            <Form.Item name="widthMm" label={t.widthLabel(unit)} rules={numberRules}>
              <InputNumber
                min={1}
                step={1}
                formatter={formatDisplayNumber}
                placeholder={t.widthPlaceholder}
                disabled={paper !== 'custom'}
              />
            </Form.Item>
            <Form.Item name="heightMm" label={t.heightLabel(unit)} rules={numberRules}>
              <InputNumber
                min={1}
                step={1}
                formatter={formatDisplayNumber}
                placeholder={t.heightPlaceholder}
                disabled={paper !== 'custom'}
              />
            </Form.Item>
            {paper !== 'custom' && (
              <Form.Item name="orientation" label={t.orientationLabel} className="print-settings-orient">
                <Radio.Group
                  options={[
                    { value: 'portrait', label: t.portrait },
                    { value: 'landscape', label: t.landscape },
                  ]}
                />
              </Form.Item>
            )}
          </div>
          <div className="print-settings-margins">
            {(['Top', 'Right', 'Bottom', 'Left'] as const).map((side, i) => (
              <Form.Item
                key={side}
                name={`margin${side}Mm`}
                label={t.marginLabel(t.margins[i], unit)}
                rules={numberRules}
              >
                <InputNumber
                  min={0}
                  step={1}
                  formatter={formatDisplayNumber}
                />
              </Form.Item>
            ))}
          </div>
          {/* Explicit derived printable dimensions */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldsValue }) => {
              const v = getFieldsValue(['widthMm', 'heightMm', 'marginTopMm', 'marginRightMm', 'marginBottomMm', 'marginLeftMm']);
              const show = (n: unknown) => (typeof n === 'number' ? Number(n.toFixed(1)) : NaN);
              const contentWidth = show(v.widthMm) - show(v.marginLeftMm) - show(v.marginRightMm);
              const contentHeight = show(v.heightMm) - show(v.marginTopMm) - show(v.marginBottomMm);
              if (!(contentWidth > 0) || !(contentHeight > 0)) return null;
              return (
                <p className="print-settings-derived">
                  {locale === 'zh' ? (
                    <>正文内容区 <strong>{Number(contentWidth.toFixed(1))} × {Number(contentHeight.toFixed(1))} {unit}</strong>，按每页这个高度分页</>
                  ) : (
                    <>Printable area: <strong>{Number(contentWidth.toFixed(1))} × {Number(contentHeight.toFixed(1))} {unit}</strong>, paginated by this height</>
                  )}
                </p>
              );
            }}
          </Form.Item>

          <div className="print-settings-divider" />
          <div className="print-settings-section-title">{t.pageNumberTitle}</div>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.pageNumber?.enabled !== curr.pageNumber?.enabled}
          >
            {({ getFieldValue }) => {
              const enabled = getFieldValue(['pageNumber', 'enabled']) ?? true;
              return (
                <div className="print-settings-grid print-settings-grid--pagenum">
                  <Form.Item name={['pageNumber', 'enabled']} label={t.showPageNumber} valuePropName="checked">
                    <Switch checkedChildren={t.switchOn} unCheckedChildren={t.switchOff} />
                  </Form.Item>
                  {enabled && (
                    <Form.Item name={['pageNumber', 'position']} label={t.pageNumberPosition}>
                      <Select
                        options={[
                          { value: 'bottom-right', label: t.posBottomRight },
                          { value: 'bottom-center', label: t.posBottomCenter },
                          { value: 'top-right', label: t.posTopRight },
                          { value: 'top-center', label: t.posTopCenter },
                        ]}
                      />
                    </Form.Item>
                  )}
                  {enabled && (
                    <Form.Item name={['pageNumber', 'format']} label={t.pageNumberFormat} className="print-settings-format">
                      <Select
                        options={[
                          { value: 'slash', label: t.fmtSlash },
                          { value: 'chinese', label: t.fmtChinese },
                          { value: 'hyphen', label: t.fmtHyphen },
                        ]}
                      />
                    </Form.Item>
                  )}
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
