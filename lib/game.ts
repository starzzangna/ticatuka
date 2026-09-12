export type Die = { id: number; value: number; shield: boolean };
export type Board = [Die[], Die[], Die[]];
export type Player = 'me' | 'cpu';
export type Phase = 'place' | 'shield' | 'knock' | 'over';
export type Difficulty = 'beginner' | 'skilled' | 'expert';

export const emptyBoard = (): Board => [[], [], []];
export const roll = () => Math.floor(Math.random() * 6) + 1;
export const full = (board: Board) => board.every((row) => row.length === 3);

export function rowScore(row: Die[]) {
  const counts = row.reduce<Record<number, number>>((acc, die) => {
    acc[die.value] = (acc[die.value] || 0) + 1;
    return acc;
  }, {});
  const baseScore = row.reduce((sum, die) => sum + die.value, 0);
  const duplicateBonus = Object.entries(counts).reduce(
    (sum, [value, count]) => sum + Number(value) * Math.max(0, count - 1),
    0,
  );
  return baseScore + duplicateBonus;
}

export function comboMultiplier(row: Die[]) {
  const counts = row.reduce<Record<number, number>>((acc, die) => {
    acc[die.value] = (acc[die.value] || 0) + 1;
    return acc;
  }, {});
  return Math.max(1, ...Object.values(counts));
}

export function scoreDistribution(base: Die[], slots: number) {
  const scores = new Map<number, number>();
  const visit = (row: Die[], left: number) => {
    if (!left) {
      const score = rowScore(row);
      scores.set(score, (scores.get(score) || 0) + 1);
      return;
    }
    for (let value = 1; value <= 6; value++) {
      visit([...row, { id: -left * 10 - value, value, shield: false }], left - 1);
    }
  };
  visit(base, Math.max(0, slots));
  return scores;
}

export function projectedLineWinChance(myRow: Die[], cpuRow: Die[], value: number, shield: boolean) {
  if (myRow.length >= 3) return 0;
  const placed = [...myRow, { id: -1, value, shield }];
  const opponent = shield ? cpuRow : cpuRow.filter((die) => die.shield || die.value !== value);
  const mine = scoreDistribution(placed, 3 - placed.length);
  const theirs = scoreDistribution(opponent, 3 - opponent.length);
  let favorable = 0;
  let total = 0;
  for (const [myScore, myCases] of mine) {
    for (const [cpuScore, cpuCases] of theirs) {
      const cases = myCases * cpuCases;
      total += cases;
      favorable += cases * (myScore > cpuScore ? 1 : myScore === cpuScore ? 0.5 : 0);
    }
  }
  return total ? Math.round((favorable / total) * 100) : 0;
}

export function cpuUtility(board: { me: Board; cpu: Board }, row: number, value: number) {
  if (board.cpu[row].length >= 3) return -Infinity;
  const before = rowScore(board.cpu[row]);
  const afterRow = [...board.cpu[row], { id: -1, value, shield: false }];
  const comboGain = rowScore(afterRow) - before;
  const hits = board.me[row].filter((die) => !die.shield && die.value === value).length;
  const threat = Math.max(0, rowScore(board.me[row]) - before);
  return comboGain * 2 + hits * 22 + threat * 0.45 + (rowScore(afterRow) > rowScore(board.me[row]) ? 10 : 0);
}


export type Boards = { me: Board; cpu: Board };

export function getNextPlayer(boards: Boards, current: Player): Player | null {
  if (full(boards.me) && full(boards.cpu)) return null;
  const other = current === 'me' ? 'cpu' : 'me';
  return full(boards[other]) ? current : other;
}

export function getResult(boards: Boards) {
  const scores = { me: boards.me.map(rowScore), cpu: boards.cpu.map(rowScore) };
  const wins = { me: 0, cpu: 0 };
  for (let i = 0; i < 3; i++) {
    if (scores.me[i] > scores.cpu[i]) wins.me++;
    else if (scores.cpu[i] > scores.me[i]) wins.cpu++;
  }
  const totals = { me: scores.me.reduce((a,b) => a+b, 0), cpu: scores.cpu.reduce((a,b) => a+b, 0) };
  const winner = wins.me >= 2 ? '내 승리' : wins.cpu >= 2 ? '상대 승리' : totals.me > totals.cpu ? '내 승리' : totals.cpu > totals.me ? '상대 승리' : '무승부';
  return { scores, wins, totals, winner };
}

// Retain victims until the animation completes. Never mutate the input board.
export function placeDie(boards: Boards, owner: Player, row: number, die: Die) {
  if (!Number.isInteger(row) || row < 0 || row > 2 || boards[owner][row].length >= 3) return null;
  const next = { me: boards.me.map(line => [...line]) as Board, cpu: boards.cpu.map(line => [...line]) as Board };
  next[owner][row].push(die);
  const other = owner === 'me' ? 'cpu' : 'me';
  const victimIds = die.shield ? [] : next[other][row].filter(d => !d.shield && d.value === die.value).map(d => d.id);
  return { boards: next, victimIds };
}

export function removeVictims(boards: Boards, victimIds: number[]): Boards {
  const clean = (board: Board) => board.map(row => row.filter(die => !victimIds.includes(die.id))) as Board;
  return { me: clean(boards.me), cpu: clean(boards.cpu) };
}

export function shouldCpuReroll(boards: Boards, value: number, difficulty: Difficulty) {
  if (difficulty === 'beginner') return false;
  const open = boards.cpu.map((r,i) => r.length < 3 ? i : -1).filter(i => i >= 0);
  if (!open.length) return false;
  const best = (v: number) => Math.max(...open.map(row => cpuUtility(boards, row, v)));
  const current = best(value);
  const expectedGain = Array.from({length:6}, (_,i) => Math.max(0, best(i+1) - current)).reduce((a,b) => a+b,0) / 6;
  return expectedGain > (difficulty === 'expert' ? 8 : 12);
}

export function chooseCpuShield(boards: Boards, value: number) {
  let best: { owner: Player; row: number; utility: number } | null = null;
  for (const owner of ['cpu','me'] as const) {
    for (let row=0; row<3; row++) {
      if (boards[owner][row].length >= 3) continue;
      const other = owner === 'cpu' ? 'me' : 'cpu';
      const before = rowScore(boards[owner][row]);
      const after = rowScore([...boards[owner][row], {id:-1,value,shield:true}]);
      const opponent = rowScore(boards[other][row]);
      const utility = (owner === 'cpu' ? 1 : -1) * (after-before + (after>opponent && before<=opponent ? 20 : 0));
      if (!best || utility > best.utility) best = {owner,row,utility};
    }
  }
  return best;
}

