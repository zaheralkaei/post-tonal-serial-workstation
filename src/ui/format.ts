// Display helpers for 24-EDO pitch classes.

const NAMES = ['C', 'C', 'C♯', 'C♯', 'D', 'D', 'D♯', 'D♯', 'E', 'E', 'F', 'F',
  'F♯', 'F♯', 'G', 'G', 'G♯', 'G♯', 'A', 'A', 'A♯', 'A♯', 'B', 'B'];
// Quarter-tone marker: odd indices are +quarter above the preceding semitone.

export function pcName(pc: number): string {
  const p = ((pc % 24) + 24) % 24;
  const base = NAMES[p];
  return p % 2 === 1 ? `${base}⁺` : base; // ⁺ = quarter-sharp inflection
}

export function isQuarter(pc: number): boolean {
  return (((pc % 24) + 24) % 24) % 2 === 1;
}
