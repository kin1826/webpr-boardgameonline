import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { diffGraphemeTiles, splitWordTiles, tileMotionClass, type RejectionPresentation, type StableTile } from './word-tiles';

type TileFrame = StableTile & { entering?: boolean; exiting?: boolean; fadeOnly?: boolean };
type Fragment = { text: string; left: number; top: number; width: number; height: number };
type FragmentSet = { id: number; tiles: Fragment[] };
type Props = { word: string; label: string; highlightLast?: boolean; animateChanges?: boolean; singleLine?: boolean; rejection?: RejectionPresentation | null; keepRejectionFragments?: boolean };

function reduceMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function AnimatedWordTiles({ word, label, highlightLast = false, animateChanges = true, singleLine = false, rejection = null, keepRejectionFragments = false }: Props) {
  const chars = splitWordTiles(word);
  const wordRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const nextIdRef = useRef(0);
  const tilesRef = useRef<TileFrame[]>(chars.map((text) => ({ id: nextIdRef.current++, text })));
  const [tiles, setTiles] = useState(tilesRef.current);
  const [fragments, setFragments] = useState<FragmentSet | null>(null);
  const handledRejectionRef = useRef<number | null>(null);
  const signature = chars.join('\u0000');
  const renderedSignature = useRef(signature);

  useLayoutEffect(() => {
    const isNewRejection = rejection && keepRejectionFragments && handledRejectionRef.current !== rejection.id;
    if (isNewRejection) {
      handledRejectionRef.current = rejection.id;
      // A fast vote can skip painting the proposal, especially on mobile. Measure
      // its suffix in this same word region when no matching old tiles exist.
      if (!reduceMotion()) {
        const origin = wordRef.current?.getBoundingClientRect();
        const proposalTiles = splitWordTiles(rejection.word);
        const hasPaintedProposal = renderedSignature.current === proposalTiles.join('\u0000');
        let measurement: HTMLSpanElement | null = null;
        let oldTiles: HTMLElement[] = [];
        if (hasPaintedProposal) oldTiles = [...(liveRef.current?.querySelectorAll<HTMLElement>('[data-suffix-tile="true"]') ?? [])];
        else if (wordRef.current && liveRef.current) {
          measurement = document.createElement('span');
          measurement.className = 'noitu-letter-live noitu-letter-measure';
          const suffixStart = proposalTiles.lastIndexOf(' ') + 1;
          proposalTiles.forEach((glyph, index) => {
            const tile = document.createElement('span');
            tile.className = glyph === ' ' ? 'noitu-letter-space' : 'noitu-letter-tile';
            tile.textContent = glyph === ' ' ? '' : glyph;
            if (index >= suffixStart) { tile.dataset.suffixTile = 'true'; tile.dataset.glyph = glyph; }
            measurement!.appendChild(tile);
          });
          wordRef.current.appendChild(measurement);
          oldTiles = [...measurement.querySelectorAll<HTMLElement>('[data-suffix-tile="true"]')];
        }
        if (origin && oldTiles.length) {
          const hiddenWidth = measurement ? Math.max(0, measurement.scrollWidth - (liveRef.current?.clientWidth ?? 0)) : 0;
          const captured = oldTiles.slice(0, 18).map((tile) => {
            const rect = tile.getBoundingClientRect();
            return { text: tile.dataset.glyph ?? '', left: rect.left - origin.left - hiddenWidth, top: rect.top - origin.top, width: rect.width, height: rect.height };
          });
          setFragments({ id: rejection.id, tiles: captured });
        }
        measurement?.remove();
      }
    }
    if (renderedSignature.current === signature) return;
    renderedSignature.current = signature;
    const previous = tilesRef.current.filter((tile) => !tile.exiting).map(({ id, text }) => ({ id, text }));
    const diff = diffGraphemeTiles(previous, chars, nextIdRef.current);
    nextIdRef.current = diff.nextId;
    const addedIds = new Set(diff.added.map((tile) => tile.id));
    const shouldAnimate = animateChanges && !reduceMotion() && !isNewRejection;
    const ordered: TileFrame[] = diff.ordered.map((tile) => ({ ...tile, entering: shouldAnimate && addedIds.has(tile.id) }));
    const exits = shouldAnimate ? diff.removed.map((tile, index) => ({ ...tile, exiting: true, fadeOnly: index >= 18 })) : [];
    tilesRef.current = [...ordered, ...exits];
    setTiles(tilesRef.current);
    if (exits.length) {
      const removedIds = new Set(exits.map((tile) => tile.id));
      const timer = window.setTimeout(() => {
        tilesRef.current = tilesRef.current.filter((tile) => !removedIds.has(tile.id));
        setTiles(tilesRef.current);
      }, 430);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [signature, animateChanges, rejection?.id, keepRejectionFragments]);

  useLayoutEffect(() => {
    if (!keepRejectionFragments) setFragments(null);
  }, [keepRejectionFragments]);

  useEffect(() => {
    if (!fragments) return;
    const id = fragments.id;
    const timer = window.setTimeout(() => setFragments((current) => current?.id === id ? null : current), 440);
    return () => window.clearTimeout(timer);
  }, [fragments?.id]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finishMotion = () => {
      if (!media.matches) return;
      tilesRef.current = tilesRef.current.filter((tile) => !tile.exiting).map((tile) => ({ ...tile, entering: false }));
      setTiles(tilesRef.current);
      setFragments(null);
    };
    media.addEventListener('change', finishMotion);
    return () => media.removeEventListener('change', finishMotion);
  }, []);

  useLayoutEffect(() => {
    if (singleLine && liveRef.current) liveRef.current.scrollLeft = liveRef.current.scrollWidth;
  }, [signature, singleLine, tiles]);

  const visibleTiles = tiles.filter((tile) => !tile.exiting);
  const lastVisibleSyllable = visibleTiles.map((tile) => tile.text).lastIndexOf(' ') + 1;
  const lastSyllableIds = new Set(visibleTiles.slice(lastVisibleSyllable).map((tile) => tile.id));
  const reducedMotion = reduceMotion();
  return <span ref={wordRef} className={`noitu-letter-word${singleLine ? ' is-single-line' : ''}`} role="img" aria-label={label}>
    <span ref={liveRef} className="noitu-letter-live">{tiles.map((tile) => {
      if (tile.text === ' ') return <span className="noitu-letter-space" aria-hidden="true" key={`space-${tile.id}`} />;
      const isLastSyllable = lastSyllableIds.has(tile.id);
      const motionClass = tileMotionClass(tile);
      return <span key={tile.id} className={`noitu-letter-tile${highlightLast && isLastSyllable ? ' is-link' : ''}${tile.entering ? ' is-entering' : ''}${motionClass ? ` ${motionClass}` : ''}`} data-glyph={tile.text} data-suffix-tile={isLastSyllable ? 'true' : undefined} aria-hidden="true">{tile.text}</span>;
    })}</span>
    {fragments && keepRejectionFragments && !reducedMotion && <span className="noitu-letter-fragments" data-rejection-fragments={fragments.id} aria-hidden="true">{fragments.tiles.map((tile, index) => <span key={`${fragments.id}-${index}`} className="noitu-letter-tile is-fracturing" data-glyph={tile.text} style={{ left: tile.left, top: tile.top, width: tile.width, height: tile.height }}>{tile.text}</span>)}</span>}
  </span>;
}
