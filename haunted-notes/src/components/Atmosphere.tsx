import React from 'react';

const SPECK_COUNT = 6;

/**
 * Background atmosphere: slow fog layers, a faint flicker, a vignette and a few
 * drifting specks. One fixed, non-interactive, aria-hidden layer behind the app,
 * so it cannot shift layout or intercept taps. How much of it shows is driven by
 * the `data-level` attribute on the app shell (see index.css).
 */
const Atmosphere: React.FC = () => (
  <div className="atmosphere" aria-hidden="true">
    <span className="fog fog--a" />
    <span className="fog fog--b" />
    <span className="fog fog--c" />
    {Array.from({ length: SPECK_COUNT }, (_, i) => (
      <span key={i} className={`speck speck--${i + 1}`} />
    ))}
  </div>
);

export default Atmosphere;
