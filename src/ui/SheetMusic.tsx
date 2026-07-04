import { useEffect, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay as OSMDType } from 'opensheetmusicdisplay';

/**
 * Renders a MusicXML string as engraved notation using OpenSheetMusicDisplay
 * (the browser MusicXML engine — same input MuseScore reads). OSMD is loaded
 * lazily and code-split; rendering is debounced so slider drags don't thrash it.
 */
export function SheetMusic({ xml }: { xml: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OSMDType | null>(null);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setStatus('rendering');
      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        if (cancelled || !hostRef.current) return;
        if (!osmdRef.current) {
          osmdRef.current = new OpenSheetMusicDisplay(hostRef.current, {
            autoResize: true,
            drawTitle: false,
            drawPartNames: true,
            backend: 'svg',
          });
        }
        await osmdRef.current.load(xml);
        if (cancelled) return;
        osmdRef.current.render();
        setStatus('idle');
      } catch (err) {
        console.error('OSMD render failed:', err);
        if (!cancelled) setStatus('error');
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [xml]);

  return (
    <div className="sheetwrap">
      {status === 'rendering' && <div className="sheetbadge">engraving…</div>}
      {status === 'error' && <div className="sheetbadge err">could not render this score</div>}
      <div className="sheet" ref={hostRef} />
    </div>
  );
}
