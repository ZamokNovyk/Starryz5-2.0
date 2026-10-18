import React from 'react';
import { usePageTransition, TRANSITIONS_LIST } from '../../src/context/PageTransitionContext';
import { PaperAirplaneTransition } from './PaperAirplaneTransition';
import { GlassShatterTransition } from './GlassShatterTransition';
import { CurtainsTransition } from './CurtainsTransition';
import { PaperCrumpleTransition } from './PaperCrumpleTransition';
import { PageFlipTransition } from './PageFlipTransition';
import { Cube3DTransition } from './Cube3DTransition';
import { OrigamiBirdTransition } from './OrigamiBirdTransition';

export const PageTransitionOverlay: React.FC = () => {
  const { isTransitioning, currentEffect, speed } = usePageTransition();

  if (!isTransitioning || currentEffect === 'none') {
    return null;
  }

  const def = TRANSITIONS_LIST.find((t) => t.id === currentEffect) || TRANSITIONS_LIST[0];
  const speedMultiplier = speed === 'fast' ? 0.75 : speed === 'slow' ? 1.35 : 1;
  const durationMs = def.durationMs * speedMultiplier;

  return (
    <>
      {currentEffect === 'airplane' && <PaperAirplaneTransition durationMs={durationMs} />}
      {currentEffect === 'glass' && <GlassShatterTransition durationMs={durationMs} />}
      {currentEffect === 'curtains' && <CurtainsTransition durationMs={durationMs} />}
      {currentEffect === 'crumple' && <PaperCrumpleTransition durationMs={durationMs} />}
      {currentEffect === 'pageflip' && <PageFlipTransition durationMs={durationMs} />}
      {currentEffect === 'cube3d' && <Cube3DTransition durationMs={durationMs} />}
      {currentEffect === 'origami' && <OrigamiBirdTransition durationMs={durationMs} />}
    </>
  );
};
