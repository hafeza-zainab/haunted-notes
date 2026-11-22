import React, { useEffect, useId, useRef } from 'react';
import { useStore } from '../store/useStore';
import { TOUR_STEPS, nextTourStep, tourStepAt } from '../lib/tour';

/**
 * 60-second tour coach mark. One step at a time in a small fixed panel, with the
 * step's target outlined. Focus moves to the panel on each step; Escape closes it
 * and focus returns to the main region. No animation: scrolling follows the page's
 * scroll-behavior, which the reduced-motion block sets to auto.
 */
const TourCoach: React.FC = () => {
  const tourStep = useStore((s) => s.tourStep);
  const advance = useStore((s) => s.advanceTour);
  const end = useStore((s) => s.endTour);
  const titleId = useId();
  const textId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const step = tourStepAt(tourStep);

  // Outline the target and move focus to the step after the view has rendered.
  useEffect(() => {
    if (!step) return;
    let marked: Element | null = null;
    const frame = requestAnimationFrame(() => {
      const el = document.querySelector(step.target);
      marked = el && step.box ? (el.closest(step.box) ?? el) : el;
      if (marked) {
        marked.classList.add('tour-target');
        marked.scrollIntoView({ block: 'start' });
      }
      boxRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      marked?.classList.remove('tour-target');
    };
  }, [step]);

  // Escape closes the tour from anywhere.
  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        end();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, end]);

  // When the tour closes, return focus to the main region so it is not lost.
  useEffect(() => {
    if (step) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      document.getElementById('main-content')?.focus();
    }
  }, [step]);

  if (!step || tourStep === null) return null;
  const isLast = nextTourStep(tourStep) === null;

  return (
    <div
      ref={boxRef}
      className="tour-coach"
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      tabIndex={-1}
    >
      <p className="tour-count">
        Step {tourStep + 1} of {TOUR_STEPS.length}
      </p>
      <h2 id={titleId} className="tour-title">{step.title}</h2>
      <p id={textId} className="tour-text">{step.text}</p>
      <div className="tour-actions">
        <button type="button" className="btn-primary" onClick={advance}>
          {isLast ? 'Finish' : 'Next'}
        </button>
        <button type="button" className="btn-ghost" onClick={end}>
          Skip tour
        </button>
      </div>
    </div>
  );
};

export default TourCoach;
