import { type PointerEvent as ReactPointerEvent, useCallback, useRef } from 'react';
import type { Direction } from '../engine';
import { swipeToDirection } from './input';

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  /** True once this gesture has produced its move. */
  fired: boolean;
}

type PointerHandler = (event: ReactPointerEvent<HTMLElement>) => void;

/** Returns pointer handlers to spread onto the element that should respond to swipes. */
export function useSwipe(onMove: (direction: Direction) => void) {
  const gesture = useRef<Gesture | null>(null);

  const onPointerDown = useCallback<PointerHandler>((event) => {
    if (!event.isPrimary) return; // ignore a second finger
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Let overlay buttons receive their own clicks. Capturing the pointer would steal them.
    if (event.target instanceof Element && event.target.closest('button')) return;

    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      fired: false,
    };
    // Keep receiving events even if the finger slides off the element.
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback<PointerHandler>(
    (event) => {
      const current = gesture.current;
      if (!current || current.fired || event.pointerId !== current.pointerId) return;

      const direction = swipeToDirection(
        event.clientX - current.startX,
        event.clientY - current.startY,
      );
      if (!direction) return;

      current.fired = true;
      onMove(direction);
    },
    [onMove],
  );

  const onPointerEnd = useCallback<PointerHandler>((event) => {
    if (gesture.current?.pointerId === event.pointerId) gesture.current = null;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };
}
