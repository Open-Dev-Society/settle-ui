import { useEffect, useRef, useState, type ReactNode } from 'react';
import { playSweep } from './motion';
import { spawnParticles } from './particles';
import type { SettlePalette, SettlePhase, SettleStatus } from './types';
import './settle.css';

const SWEEP_MS = 560;
const DISSOLVE_MS = 640;

export type SettleProps = {
  /** pending while saving, success once confirmed, error when it failed. */
  status: SettleStatus;
  palette?: SettlePalette;
  /**
   * Omit to follow the system setting.
   * true skips shimmer, sweep, and particles. false forces motion.
   */
  reducedMotion?: boolean;
  /** At most once after a success transition finishes. Not called if that transition is cancelled. */
  onSettled?: () => void;
  className?: string;
  children: ReactNode;
};

function systemReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useSystemReducedMotion(): boolean {
  const [matches, setMatches] = useState(systemReducedMotion);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return matches;
}

function mountPhase(status: SettleStatus): SettlePhase {
  if (status === 'success') return 'settled';
  if (status === 'error') return 'error';
  return 'pending';
}

export function Settle({
  status,
  palette = 'opal',
  reducedMotion,
  onSettled,
  className,
  children,
}: SettleProps) {
  const systemReduced = useSystemReducedMotion();
  const reduce = reducedMotion ?? systemReduced;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const track = useRef({ status, generation: 0 });
  if (track.current.status !== status) {
    track.current = { status, generation: track.current.generation + 1 };
  }
  const generation = track.current.generation;

  const [phase, setPhase] = useState<SettlePhase>(() => mountPhase(status));
  const handled = useRef<number | null>(null);
  const sweepRef = useRef<HTMLSpanElement>(null);
  const particlesRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancel = () => {};
    let timer = 0;
    let stopped = false;
    const generationNow = generation;

    if (status === 'pending') {
      setPhase('pending');
    } else if (status === 'success') {
      const already = generationNow === 0 || handled.current === generationNow;
      if (already) {
        setPhase('settled');
      } else if (reduce) {
        handled.current = generationNow;
        setPhase('settled');
        onSettledRef.current?.();
      } else {
        setPhase('sweeping');
        const sweep = sweepRef.current;
        if (!sweep) {
          handled.current = generationNow;
          setPhase('settled');
          onSettledRef.current?.();
        } else {
          const motion = playSweep(sweep, SWEEP_MS);
          cancel = motion.cancel;
          void motion.finished.then(() => {
            if (stopped || handled.current === generationNow) return;
            handled.current = generationNow;
            setPhase('settled');
            onSettledRef.current?.();
          });
        }
      }
    } else if (generationNow === 0 || reduce) {
      setPhase('error');
    } else {
      setPhase('dissolving');
      const layer = particlesRef.current;
      const stop = layer ? spawnParticles(layer) : () => {};
      cancel = stop;
      timer = window.setTimeout(() => {
        if (stopped) return;
        stop();
        setPhase('error');
      }, DISSOLVE_MS);
    }

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      cancel();
    };
  }, [status, reduce, generation]);

  const reduceMode = reducedMotion === undefined ? 'system' : reduce ? 'true' : 'false';

  return (
    <div
      className={className ? `settle ${className}` : 'settle'}
      data-status={status}
      data-phase={phase}
      data-palette={palette}
      data-reduce={reduceMode}
      aria-busy={status === 'pending' ? true : undefined}
    >
      {status === 'pending' ? <span className="settle-sr">Sending…</span> : null}
      <span className="settle-rim" aria-hidden="true" />
      <span ref={sweepRef} className="settle-sweep" aria-hidden="true" />
      <span ref={particlesRef} className="settle-particles" aria-hidden="true" />
      <div className="settle-body">{children}</div>
    </div>
  );
}
