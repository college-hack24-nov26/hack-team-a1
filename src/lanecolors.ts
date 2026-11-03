import { CodeLane } from './types';

export interface LaneVisuals {
  name: string;
  color: string;
  backgroundColor: string;
  overviewRulerColor: string;
  iconRelativePath?: string;
  description: string;
}

/**
 * Single source of truth for Buildtri code lane visual styling and colors.
 */
export const LANE_COLORS: Record<CodeLane, LaneVisuals> = {
  vibe: {
    name: 'Vibe',
    color: '#e5c07b',
    backgroundColor: 'rgba(229, 192, 123, 0.12)',
    overviewRulerColor: '#e5c07b',
    iconRelativePath: 'resources/gutter-vibe.svg',
    description: 'AI-generated code, pending human review.'
  },
  hybrid: {
    name: 'Hybrid',
    color: '#61afef',
    backgroundColor: 'rgba(97, 175, 239, 0.10)',
    overviewRulerColor: '#61afef',
    iconRelativePath: 'resources/gutter-hybrid.svg',
    description: 'AI draft, reviewed and approved by human.'
  },
  manual: {
    name: 'Manual',
    color: '#98c379',
    backgroundColor: 'transparent',
    overviewRulerColor: 'transparent',
    description: 'Human-authored code.'
  }
};

