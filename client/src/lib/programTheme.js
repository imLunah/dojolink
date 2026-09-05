// One place for how a program and a belt LOOK, shared by the parent portal's
// pages and the older progress cards so the two cannot drift.
//
// Program identity colours are pinned (JR purple, CREATE / Robotics / AI blue)
// and do NOT follow the theme accent. Belts take their own colour from
// beltConfig; the hero gradient is built from it here so a belt-up recolours
// the whole hero without anyone touching a stylesheet.

import { getBelt } from '../utils/beltConfig';

export const PROGRAM_GRADIENTS = {
  // CREATE's banner is the CREATE blue at every belt. The belt shows as its
  // icon on the banner, not as the banner's colour, which is what keeps a
  // White or Yellow belt from turning the whole hero pale.
  'CREATE':           'linear-gradient(145deg, #2f74e6 0%, #1355c9 50%, #0c3d99 100%)',
  'Robotics Academy': 'linear-gradient(135deg, #060d1a 0%, #0a1e3d 55%, #0d3070 100%)',
  'AI Academy':       'linear-gradient(135deg, #060c1f 0%, #091840 55%, #0e2a7a 100%)',
  'JR':               'linear-gradient(135deg, #1a0533 0%, #2d1267 55%, #4c1d95 100%)',
  'VR Coding':        'linear-gradient(135deg, #04181c 0%, #073a40 55%, #0b5e63 100%)',
};

export const PROGRAM_BAR_COLORS = {
  'Robotics Academy': '#2563eb',
  'AI Academy':       '#1d4ed8',
  'JR':               '#7c3aed',
  'VR Coding':        '#14b8a6',
};

export const JR_CODING_MODULES = ['Module 1','Module 2','Module 3','Module 4','Module 5','Module 6','Module 7','Module 8','Module 9','Module 10'];
export const SNAP_CIRCUITS_TOTAL = 24;

export const KIT_ORDER  = ['LEGO Spike Essentials', 'LEGO Spike Prime', 'VEX GO', 'Ozobot Evo'];
export const KIT_SHORT  = { 'LEGO Spike Essentials': 'Essentials', 'LEGO Spike Prime': 'Prime', 'VEX GO': 'VEX GO', 'Ozobot Evo': 'Ozobot' };
export const KIT_TOTALS = { 'LEGO Spike Essentials': 8, 'LEGO Spike Prime': 4, 'VEX GO': 4, 'Ozobot Evo': 2 };

// The hero for a belt: the belt's own colour, deepened towards the bottom
// right, with the ink the belt config already declares so a White or Yellow
// belt stays readable. Falls back to the CREATE blue when no belt is set yet.
export function beltHero(beltName) {
  const belt = getBelt(beltName);
  if (!belt) {
    return { background: 'linear-gradient(150deg, #006add 0%, #004fa8 100%)', color: '#ffffff', shadow: 'rgb(0 79 168 / 0.35)', light: false, onHero: '#ffffff', onHeroDim: 'rgb(255 255 255 / 0.22)', onHeroMid: 'rgb(255 255 255 / 0.5)', face: 'rgb(0 0 0 / 0.16)' };
  }
  const c = belt.color;
  const ink = belt.textColor || '#ffffff';
  // A pale belt (White, Yellow, Silver, Platinum) carries dark ink, and
  // everything drawn on the hero (gauge, bar, pills) has to be drawn in that
  // ink and its tints, or it vanishes into the pale material. `onHero` is the
  // colour to use for chrome on the hero; `onHeroDim` for its unfilled state.
  const light = ink !== '#ffffff';
  return {
    background: light
      ? `linear-gradient(150deg, color-mix(in srgb, ${c} 92%, white) 0%, ${c} 45%, color-mix(in srgb, ${c} 78%, black) 100%)`
      : `linear-gradient(150deg, color-mix(in srgb, ${c} 88%, white) 0%, ${c} 40%, color-mix(in srgb, ${c} 68%, black) 100%)`,
    color: ink,
    shadow: light ? 'rgb(26 46 74 / 0.22)' : `color-mix(in srgb, ${c} 45%, transparent)`,
    solid: c,
    light,
    onHero: light ? 'rgb(26 46 74 / 0.9)' : '#ffffff',
    onHeroDim: light ? 'rgb(26 46 74 / 0.16)' : 'rgb(255 255 255 / 0.22)',
    onHeroMid: light ? 'rgb(26 46 74 / 0.32)' : 'rgb(255 255 255 / 0.5)',
    face: light ? 'rgb(255 255 255 / 0.55)' : 'rgb(0 0 0 / 0.16)',
  };
}

// The hero for a program that has no belt: its pinned identity gradient.
export function programHero(program) {
  return {
    background: PROGRAM_GRADIENTS[program] || 'linear-gradient(150deg, #006add 0%, #004fa8 100%)',
    color: '#ffffff',
    shadow: 'rgb(26 46 74 / 0.35)',
    light: false,
    onHero: '#ffffff',
    onHeroDim: 'rgb(255 255 255 / 0.22)',
    onHeroMid: 'rgb(255 255 255 / 0.5)',
    face: 'rgb(0 0 0 / 0.16)',
  };
}
