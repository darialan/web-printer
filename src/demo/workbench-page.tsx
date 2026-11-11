import { lazy, Suspense } from 'react';
import { BrandMark, BrandWordmark, Icon } from '../landing/icons';
import { useTheme } from '../landing/theme';
import { demoCopy, Locale, LocaleProvider, useLocale } from './ui/locale';
import '../landing/site.css';
import '../landing/workbench-page.css';

const InteractiveWorkbench = lazy(() => import('../landing/interactive-workbench'));
const REPO = 'https://github.com/darialan/web-printer';

function WorkbenchPageContent() {
  const [theme, setTheme] = useTheme();
  const [locale, setLocale] = useLocale();
  const copy = demoCopy[locale];

  return (
    <div className="workbench-page site-page" data-locale={locale}>
      <a className="skip-link" href="#main">{copy.skip}</a>
      <header className="workbench-topbar">
        <div className="workbench-topbar-inner">
          <a className="brand" href="#/" aria-label={copy.home}>
            <BrandMark /><BrandWordmark />
          </a>
          <span className="workbench-topbar-title">{copy.workbenchTitle}</span>
          <div className="workbench-topbar-actions">
            <button
              type="button"
              className="language-toggle"
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              aria-label={copy.langAria}
              title={copy.langAria}
            >
              <span lang={locale === 'zh' ? 'en' : 'zh-CN'}>{copy.langToggle}</span>
            </button>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? copy.themeDark : copy.themeLight}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
            </button>
            <a className="icon-btn" href={REPO} target="_blank" rel="noreferrer" aria-label={copy.github} title="GitHub">
              <Icon name="github" size={18} />
            </a>
            <a href="#/" className="btn btn-ghost btn-small">{copy.backHome}</a>
          </div>
        </div>
      </header>
      <main className="workbench-main" id="main">
        <Suspense fallback={<div className="workbench-loading" role="status">{copy.loadingWorkbench}</div>}>
          <InteractiveWorkbench locale={locale} />
        </Suspense>
      </main>
    </div>
  );
}

export default function WorkbenchPage({ locale }: { locale?: Locale }) {
  return (
    <LocaleProvider initialLocale={locale}>
      <WorkbenchPageContent />
    </LocaleProvider>
  );
}
