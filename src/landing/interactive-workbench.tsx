import { useEffect } from 'react';
import { DEMO_SCENES, PrintWorkbench } from '../demo';
import { Locale, useLocale } from './locale';

export default function InteractiveWorkbench({ locale: propLocale }: { locale?: Locale }) {
  const [activeLocale] = useLocale();
  const locale = propLocale || activeLocale;
  const sceneKey = new URLSearchParams(window.location.hash.split('?')[1]).get('scene') || undefined;

  // On narrow screens, scene tabs scroll horizontally; scroll active tab into view after switching
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('.print-tab-custom .ant-tabs-tab-active')
        ?.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sceneKey]);

  return <PrintWorkbench key={`${sceneKey || ''}-${locale}`} scenes={DEMO_SCENES} initialSceneKey={sceneKey} locale={locale} />;
}
