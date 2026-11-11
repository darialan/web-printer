import { useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { demoAsset } from '../ui/business-page';
import { useLocale } from '../ui/locale';

export const COMPLEX_MIXED_CONTENT_ID = 'print-content-complex-mixed';

const ARTICLE_CONTENT = {
  zh: {
    title: '用 TorchOptics 逆向设计一条凸 Accelerating Beam 轨迹',
    category: '计算光学',
    topic: 'Accelerating Beam · 逆向设计',
    digest: '用可微 PyTorch 优化器在一维 phase-only mask 上学习输入相位，让 Gaussian 输入沿指定凸抛物线轨迹传播，并结合 TorchOptics 检查二维传播截面。',
    loading: '正在加载文章内容…',
    loadError: '文章加载失败，请检查网络后重试。',
    retry: '重试加载',
    asset: 'torchoptics-article.html',
  },
  en: {
    title: 'Inverse Designing a Convex Accelerating Beam Trajectory with TorchOptics',
    category: 'Computational Optics',
    topic: 'Accelerating Beam · Inverse Design',
    digest: 'Learn an input phase profile on a 1D phase-only mask using a differentiable PyTorch optimizer to steer a Gaussian input along a prescribed convex parabolic trajectory, then inspect 2D propagation cross-sections with TorchOptics.',
    loading: 'Loading article content…',
    loadError: 'Failed to load article content. Please check your network and retry.',
    retry: 'Retry',
    asset: 'torchoptics-article.en.html',
  },
};

// Retains original HTML, math formulas, code syntax highlighting, and typography.
export function ComplexMixedDemo() {
  const [locale] = useLocale();
  const copy = ARTICLE_CONTENT[locale === 'en' ? 'en' : 'zh'];
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    fetch(demoAsset(copy.asset), { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error(String(res.status)); return res.text(); })
      .then(html => {
        if (controller.signal.aborted || !bodyRef.current) return;
        bodyRef.current.innerHTML = html;
        // The source article lacks page-break markers, so attach data-print-atomic to images and code blocks
        // to prevent them from being split across page boundaries.
        bodyRef.current.querySelectorAll('img, pre').forEach(el => el.setAttribute('data-print-atomic', 'true'));
        setStatus('ready');
        window.dispatchEvent(new CustomEvent('print-demo-content-change', { detail: { contentId: COMPLEX_MIXED_CONTENT_ID } }));
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [attempt, copy.asset]);

  return (
    <article id={COMPLEX_MIXED_CONTENT_ID} className="business-article" data-print-status={status}>
      <header className="article-cover">
        <h1>{copy.title}</h1>
        <p className="article-meta"><span>{copy.category}</span><span>·</span><span>{copy.topic}</span></p>
        <p className="article-digest">{copy.digest}</p>
      </header>
      {status === 'error' && (
        <div role="alert">
          <p>{copy.loadError}</p>
          <Button onClick={() => setAttempt(value => value + 1)}>{copy.retry}</Button>
        </div>
      )}
      {status === 'loading' && <p className="business-muted">{copy.loading}</p>}
      {/* bodyRef content is directly populated via innerHTML in the effect above;
          React should not manage children inside this container to prevent node mismatch during unmount. */}
      <div className="article-body" ref={bodyRef} />
    </article>
  );
}
