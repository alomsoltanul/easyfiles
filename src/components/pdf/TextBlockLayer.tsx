'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { pdfPointToVisual } from '@/lib/pdf-common';
import { ASCENT_RATIO, type LiveBlock } from '@/lib/pdf-text-layer';
import { fontCss, layoutLine, type TextMetrics } from '@/lib/pdf-text-metrics';

/**
 * Draws the re-typeset text layer on top of the rendered page.
 *
 * Blocks the user has not touched render nothing — the original page pixels
 * show through. A block that changed, or that a neighbour pushed out of place,
 * paints its old rectangle out and lays the new lines down at exactly the
 * positions the PDF writer will use, so the preview and the export agree.
 */

/**
 * Where a browser puts the baseline inside a `line-height: 1` box, as a
 * fraction of the font size. Only the preview needs this — the exported file
 * is positioned from real font metrics.
 */
const CSS_BASELINE = 0.755;

interface Geometry {
  width: number;
  height: number;
  rotation: number;
}

interface Props {
  blocks: LiveBlock[];
  geometry: Geometry;
  stage: { width: number; height: number };
  /** Screen pixels per PDF point. */
  ptToPx: number;
  metrics: TextMetrics;
  /** The block the inspector is pointed at. */
  activeId: string | null;
  /** The block with an open caret. Styling changes made while typing stick. */
  editingId: string | null;
  /** False while another tool owns the page, so blocks stop taking clicks. */
  interactive: boolean;
  onActivate: (id: string) => void;
  onText: (id: string, text: string) => void;
  onDone: () => void;
}

export default function TextBlockLayer({
  blocks,
  geometry,
  stage,
  ptToPx,
  metrics,
  activeId,
  editingId,
  interactive,
  onActivate,
  onText,
  onDone,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const angle = ((geometry.rotation % 360) + 360) % 360;

  // Focus the box the moment it opens, caret at the end.
  useEffect(() => {
    if (!editingId) return;
    const field = inputRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [editingId]);

  // Grow the field to fit whatever has been typed into it.
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  });

  if (stage.width === 0 || stage.height === 0) return null;

  /** Top-left screen position of a point given in PDF user space. */
  const corner = (px: number, py: number) => {
    const point = pdfPointToVisual(px, py, geometry.width, geometry.height, angle);
    return { left: point.x * stage.width, top: point.y * stage.height };
  };

  const turned = { transform: `rotate(${angle}deg)`, transformOrigin: '0 0' };

  return (
    <>
      {/* Every patch goes down before any text does. A block that moved can end
          up over the ground its neighbour used to occupy, and painting them
          block by block would let that neighbour's patch clip the new lines. */}
      {blocks.map((live) =>
        live.managed ? (
          <div
            key={`cover-${live.block.id}`}
            aria-hidden
            className="absolute"
            style={{
              ...corner(live.block.cover.x, live.block.cover.y + live.block.cover.height),
              width: live.block.cover.width * ptToPx,
              height: live.block.cover.height * ptToPx,
              background: live.background,
              ...turned,
            }}
          />
        ) : null
      )}

      {blocks.map((live) => {
        const { block } = live;
        const selected = activeId === block.id;
        const editing = editingId === block.id;
        if (!live.managed && !interactive) return null;

        const boxTop = block.top + live.shift;
        const boxAt = corner(block.x, boxTop);
        const boxWidth = block.width * ptToPx;
        const boxHeight = Math.max(live.height, live.lineHeight) * ptToPx;

        return (
          <React.Fragment key={block.id}>
            <div
              className="absolute"
              style={{ left: boxAt.left, top: boxAt.top, width: boxWidth, height: boxHeight, ...turned }}
            >
              {live.managed && !editing &&
                live.lines.flatMap((line, row) =>
                  layoutLine(line, live.font, live.size, block.width, live.align, metrics).map((run, index) => (
                    <span
                      key={`${row}-${index}`}
                      className="absolute whitespace-pre"
                      style={{
                        left: run.x * ptToPx,
                        top: (row * live.lineHeight + (ASCENT_RATIO - CSS_BASELINE) * live.size) * ptToPx,
                        fontSize: live.size * ptToPx,
                        lineHeight: 1,
                        color: live.color,
                        ...fontCss(live.font),
                      }}
                    >
                      {run.text}
                    </span>
                  ))
                )}

              {editing ? (
                <textarea
                  ref={inputRef}
                  value={live.text}
                  onChange={(event) => onText(block.id, event.target.value)}
                  onBlur={onDone}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
                      event.preventDefault();
                      onDone();
                    }
                    event.stopPropagation();
                  }}
                  spellCheck={false}
                  className="absolute left-0 top-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-2 outline-offset-4 outline-[#ec3013]"
                  style={{
                    top: (ASCENT_RATIO - CSS_BASELINE) * live.size * ptToPx,
                    minHeight: boxHeight,
                    fontSize: live.size * ptToPx,
                    lineHeight: `${live.lineHeight * ptToPx}px`,
                    color: live.color,
                    textAlign: live.align === 'justify' ? 'left' : live.align,
                    ...fontCss(live.font),
                  }}
                />
              ) : (
                interactive && (
                  <button
                    type="button"
                    title={
                      live.missing.length > 0
                        ? 'The standard PDF fonts cannot draw these characters — you can delete this text, but retyping it will not keep them'
                        : block.cell ? 'Edit this cell' : 'Edit this text'
                    }
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onActivate(block.id);
                    }}
                    className={`absolute -inset-y-0.5 -inset-x-1 cursor-text border transition-colors ${
                      selected
                        ? 'border-[#ec3013] bg-[rgba(236,48,19,0.1)] outline-1 outline-offset-1 outline-[#ec3013]'
                        : live.changed
                          ? 'border-[#ec3013] bg-[rgba(236,48,19,0.06)]'
                          : 'border-transparent hover:border-[#1d4ed8] hover:bg-[rgba(29,78,216,0.07)]'
                    }`}
                  />
                )
              )}
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
}
