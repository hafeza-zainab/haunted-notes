import React, { useId } from 'react';
import { useStore } from '../store/useStore';
import { hauntedLevel, LEVEL_NAMES } from '../lib/haunt';

/**
 * Header meter: how haunted the room is, from the weakness of all unbanished
 * ghosts. Five segments; the visible text names the tier, so the meter never
 * relies on colour alone. Not interactive.
 */
const HauntMeter: React.FC = () => {
  const flashcards = useStore((s) => s.flashcards);
  const labelId = useId();
  const level = hauntedLevel(flashcards);

  return (
    <div
      className="haunt-meter"
      role="meter"
      aria-labelledby={labelId}
      aria-valuemin={0}
      aria-valuemax={LEVEL_NAMES.length - 1}
      aria-valuenow={level.tier}
      aria-valuetext={`${level.name}, ${level.weakCount} weak ghost${level.weakCount === 1 ? '' : 's'}`}
    >
      <span id={labelId} className="haunt-meter-label">
        Haunted: <strong>{level.name}</strong>
      </span>
      <span className="haunt-meter-bars" aria-hidden="true">
        {LEVEL_NAMES.map((name, i) => (
          <span
            key={name}
            className={`haunt-meter-seg ${i <= level.tier && level.tier > 0 ? 'on' : ''}`}
          />
        ))}
      </span>
    </div>
  );
};

export default HauntMeter;
