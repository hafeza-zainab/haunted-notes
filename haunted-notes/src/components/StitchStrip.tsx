import React, { useId } from 'react';

const INPUTS = ['Type', 'Speak', 'Photo', 'Audio file'] as const;
const STAGES = ['Flashcards', 'Ghosts', 'Spaced review'] as const;

/**
 * "How it's stitched": four unrelated inputs feed one pipeline. Static and not
 * interactive. Arrows are decorative; the lists carry the meaning for screen readers.
 */
const StitchStrip: React.FC = () => {
  const captionId = useId();
  return (
    <figure className="stitch-strip" aria-labelledby={captionId}>
      <figcaption id={captionId}>Four inputs, one ghost pipeline</figcaption>
      <div className="stitch-flow">
        <ul className="stitch-inputs" aria-label="Inputs">
          {INPUTS.map((name) => (
            <li key={name} className="stitch-chip">{name}</li>
          ))}
        </ul>
        <span className="stitch-arrow stitch-arrow--join" aria-hidden="true">→</span>
        <ol className="stitch-stages" aria-label="Pipeline">
          {STAGES.map((name, i) => (
            <li key={name}>
              {i > 0 && <span className="stitch-arrow" aria-hidden="true">→</span>}
              <span className="stitch-chip stitch-chip--stage">{name}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
};

export default StitchStrip;
