import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import { money } from '../ui/business-page';
import { Locale, useLocale } from '../ui/locale';

export const PURCHASE_ORDER_CONTENT_ID = 'print-content6';

const materialsZh = [
  { code: 'PKG-CUP-500', name: '冷饮纸杯', spec: '500ml · 1,000只/箱', price: 185 },
  { code: 'PKG-LID-90', name: '平口杯盖', spec: '90mm · 1,000只/箱', price: 92.5 },
  { code: 'PKG-STR-12', name: '独立包装纸吸管', spec: '12mm · 2,000支/箱', price: 68 },
  { code: 'PKG-BAG-02', name: '双杯牛皮纸袋', spec: '240 × 120 × 280mm · 500只/箱', price: 110 },
  { code: 'PKG-SLV-01', name: '瓦楞隔热杯套', spec: '通用款 · 2,000只/箱', price: 45 },
];

const materialsEn = [
  { code: 'PKG-CUP-500', name: 'Cold Beverage Paper Cup', spec: '500ml · 1,000 pcs/box', price: 185 },
  { code: 'PKG-LID-90', name: 'Flat Cup Lid', spec: '90mm · 1,000 pcs/box', price: 92.5 },
  { code: 'PKG-STR-12', name: 'Individually Wrapped Paper Straw', spec: '12mm · 2,000 pcs/box', price: 68 },
  { code: 'PKG-BAG-02', name: 'Double-Cup Kraft Paper Bag', spec: '240 × 120 × 280mm · 500 pcs/box', price: 110 },
  { code: 'PKG-SLV-01', name: 'Corrugated Thermal Cup Sleeve', spec: 'Universal · 2,000 pcs/box', price: 45 },
];

const storesZh = [
  '滨江江陵路店', '西湖文三路店', '余杭未来科技城店', '上城钱江新城店', '拱墅大悦城店',
  '萧山金城路店', '滨江星光大道店', '西湖黄龙店', '上城湖滨店',
];

const storesEn = [
  'Jiangling Rd Store (Binjiang)', 'Wensan Rd Store (West Lake)', 'Future Tech City Store (Yuhang)',
  'Qianjiang New Town Store (Shangcheng)', 'Joy City Store (Gongshu)', 'Jincheng Rd Store (Xiaoshan)',
  'Starlight Ave Store (Binjiang)', 'Huanglong Store (West Lake)', 'Hubin Store (Shangcheng)',
];

export function buildPurchaseRows(count: number, locale: Locale = 'zh') {
  const isEn = locale === 'en';
  const mList = isEn ? materialsEn : materialsZh;
  const sList = isEn ? storesEn : storesZh;

  return Array.from({ length: count }, (_, i) => {
    const material = mList[i % 5];
    const ordered = 8 + (i % 7) * 2;
    const received = i % 6 === 0 ? 0 : ordered;
    const status = isEn ? (i % 6 === 0 ? 'Pending' : 'Delivered') : (i % 6 === 0 ? '待到货' : '已收货');
    return {
      ...material,
      key: `po-${i + 1}`,
      store: sList[Math.floor(i / 5) % sList.length],
      ordered,
      received,
      status,
      delivery: `2026-10-${String(26 + Math.floor(i / 45)).padStart(2, '0')}`,
    };
  });
}

// Keep Chinese dataset exported as default for tests and backwards compatibility
export const purchaseOrderRows = buildPurchaseRows(45, 'zh');
export const orderedTotal = purchaseOrderRows.reduce((sum, r) => sum + Math.round(r.price * r.ordered * 100), 0) / 100;
type Row = typeof purchaseOrderRows[number];

export function PurchaseOrderDemo() {
  const [locale] = useLocale();
  const isEn = locale === 'en';
  const dataSource = useMemo(() => (isEn ? buildPurchaseRows(45, 'en') : purchaseOrderRows), [isEn]);

  const columns: ColumnsType<Row> = useMemo(() => [
    {
      title: isEn ? 'Store / Destination' : '门店 / 收货点',
      width: '18%',
      render: (_, r) => (
        <div>
          {r.store}
          <div className="business-muted">{isEn ? `Est. Delivery: ${r.delivery}` : `计划到货 ${r.delivery}`}</div>
        </div>
      ),
    },
    {
      title: isEn ? 'Material' : '物料',
      width: '25%',
      render: (_, r) => (
        <div>
          <strong>{r.name}</strong>
          <div className="business-muted">{r.code} · {r.spec}</div>
        </div>
      ),
    },
    {
      title: isEn ? 'Ordered / Box' : '订购 / 箱',
      dataIndex: 'ordered',
      align: 'right',
      width: '10%',
    },
    {
      title: isEn ? 'Received / Box' : '已收 / 箱',
      dataIndex: 'received',
      align: 'right',
      width: '10%',
    },
    {
      title: isEn ? 'Unit Price (Tax incl.)' : '含税单价',
      align: 'right',
      width: '12%',
      render: (_, r) => money(r.price),
    },
    {
      title: isEn ? 'Amount (Tax incl.)' : '含税金额',
      align: 'right',
      width: '14%',
      render: (_, r) => money(r.price * r.ordered),
    },
    {
      title: isEn ? 'Delivery Status' : '收货状态',
      width: '11%',
      render: (_, r) => <Tag color={r.received === 0 ? 'orange' : undefined}>{r.status}</Tag>,
    },
  ], [isEn]);

  return (
    <div className="table-demo" id={PURCHASE_ORDER_CONTENT_ID}>
      <Table
        size="small"
        pagination={false}
        rowKey="key"
        dataSource={dataSource}
        columns={columns}
        tableLayout="fixed"
      />
    </div>
  );
}
