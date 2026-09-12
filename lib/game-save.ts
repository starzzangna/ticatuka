import type { Boards, Difficulty, Phase, Player } from './game';

export const SAVE_KEY = 'ticatuka.save.v1';
export type SavedGame = {
  version: 1; boards: Boards; turn: Player; phase: Phase; value: number;
  isShield: boolean; rerolls: { me: boolean; cpu: boolean }; choice: number[] | null;
  difficulty: Difficulty; gameNo: number; sound: boolean; message: string;
};

export function readSave(raw: string | null): SavedGame | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SavedGame;
    const validValue = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6;
    if (s.version !== 1 || !['me','cpu'].includes(s.turn) ||
      !['place','shield','over'].includes(s.phase) ||
      !['beginner','skilled','expert'].includes(s.difficulty) ||
      !validValue(s.value) || typeof s.isShield !== 'boolean' || typeof s.sound !== 'boolean' ||
      !Number.isSafeInteger(s.gameNo) || s.gameNo < 1 || typeof s.message !== 'string' ||
      typeof s.rerolls?.me !== 'boolean' || typeof s.rerolls?.cpu !== 'boolean' ||
      !(s.choice === null || (Array.isArray(s.choice) && s.choice.length === 2 && s.choice.every(validValue)))) return null;
    const ids = new Set<number>();
    for (const owner of ['me','cpu'] as const) {
      if (!Array.isArray(s.boards?.[owner]) || s.boards[owner].length !== 3) return null;
      for (const row of s.boards[owner]) {
        if (!Array.isArray(row) || row.length > 3) return null;
        for (const die of row) {
          if (!die || !validValue(die.value) || typeof die.shield !== 'boolean' || !Number.isFinite(die.id) || ids.has(die.id)) return null;
          ids.add(die.id);
        }
      }
    }
    const bothFull = s.boards.me.every(r => r.length === 3) && s.boards.cpu.every(r => r.length === 3);
    if (s.phase === 'over' ? !bothFull : bothFull) return null;
    if (s.phase === 'shield' && (!s.isShield || s.turn !== 'me' || s.choice)) return null;
    if (s.choice && (s.turn !== 'me' || s.phase !== 'place' || s.rerolls.me)) return null;
    return s;
  } catch { return null; }
}
