import React from 'react';
import type { DemoCardText } from '../lib/demoScript';

/** Text-only card shown over the app during the intro and the Built with Kiro chapter. */
const DemoCard: React.FC<{ card: DemoCardText }> = ({ card }) => (
  <div className="demo-card">
    <p className="demo-card-title">{card.title}</p>
    {card.lines.map((line) => (
      <p key={line} className="demo-card-line">
        {line}
      </p>
    ))}
  </div>
);

export default DemoCard;
