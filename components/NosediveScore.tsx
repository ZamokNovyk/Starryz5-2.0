import React from 'react';
import { formatNosediveScore } from '../src/lib/ratingUtils';

interface NosediveScoreProps {
  score: number | string | undefined | null;
  className?: string;
  mainClassName?: string;
  subClassName?: string;
}

export const NosediveScore: React.FC<NosediveScoreProps> = ({
  score,
  className = '',
  mainClassName = '',
  subClassName = 'text-[0.62em] font-normal opacity-70 ml-0.5 tracking-normal',
}) => {
  const { main, sub } = formatNosediveScore(score);

  return (
    <span className={`inline-flex items-baseline font-mono tracking-tight select-none ${className}`}>
      <span className={mainClassName}>{main}</span>
      <span className={subClassName}>{sub}</span>
    </span>
  );
};

export default NosediveScore;

