'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, RotateCcw, Shield, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Die = { id: number; value: number; shield: boolean };
type Board = [Die[], Die[], Die[]];
type Player = 'me' | 'cpu';
type Phase = 'place' | 'shield' | 'knock' | 'over';
type Difficulty = 'beginner' | 'skilled' | 'expert';
type Profile = { name: string; title: string; image: string; difficulty?: Difficulty; level?: string };
type KnockFx = { attacker: Player; attackerId: number; victimIds: number[]; row: number };

const PLAYER_PROFILE: Profile = { name: '루미', title: '룬 탐험가', image: '/profiles/lumi.png' };
const OPPONENTS: Record<Difficulty, Profile> = {
  beginner: { name: '모모', title: '주사위 견습생', image: '/profiles/momo.png', difficulty: 'beginner', level: '초보' },
  skilled: { name: '카인', title: '주사위 사냥꾼', image: '/profiles/kain.png', difficulty: 'skilled', level: '숙련' },
  expert: { name: '베라', title: '룬 마스터', image: '/profiles/vera.png', difficulty: 'expert', level: '전문가' },
};

const emptyBoard = (): Board => [[], [], []];
const roll = () => Math.floor(Math.random() * 6) + 1;
const full = (board: Board) => board.every((row) => row.length === 3);

function rowScore(row: Die[]) {
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

function comboMultiplier(row: Die[]) {
  const counts = row.reduce<Record<number, number>>((acc, die) => {
    acc[die.value] = (acc[die.value] || 0) + 1;
    return acc;
  }, {});
  return Math.max(1, ...Object.values(counts));
}

function scoreDistribution(base: Die[], slots: number) {
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

function projectedLineWinChance(myRow: Die[], cpuRow: Die[], value: number, shield: boolean) {
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

function cpuUtility(board: { me: Board; cpu: Board }, row: number, value: number) {
  if (board.cpu[row].length >= 3) return -Infinity;
  const before = rowScore(board.cpu[row]);
  const afterRow = [...board.cpu[row], { id: -1, value, shield: false }];
  const comboGain = rowScore(afterRow) - before;
  const hits = board.me[row].filter((die) => !die.shield && die.value === value).length;
  const threat = Math.max(0, rowScore(board.me[row]) - before);
  return comboGain * 2 + hits * 22 + threat * 0.45 + (rowScore(afterRow) > rowScore(board.me[row]) ? 10 : 0);
}

function DieFace({ die, active = false, motion = '' }: { die: Die; active?: boolean; motion?: string }) {
  return (
    <div
      role="img"
      aria-label={`${die.shield ? '실드' : '일반'} 주사위 ${die.value}`}
      className={`die die-${die.value} ${die.shield ? 'shield-die' : ''} ${active ? 'active-die' : ''} ${motion}`}
    >
      {Array.from({ length: die.value }).map((_, index) => <span key={index} className="pip" />)}
    </div>
  );
}

export default function Home() {
  const [boards, setBoards] = useState<{ me: Board; cpu: Board }>({ me: emptyBoard(), cpu: emptyBoard() });
  const [turn, setTurn] = useState<Player>('me');
  const [phase, setPhase] = useState<Phase>('place');
  const [value, setValue] = useState(1);
  const [isShield, setIsShield] = useState(true);
  const [rerolls, setRerolls] = useState({ me: true, cpu: true });
  const [choice, setChoice] = useState<number[] | null>(null);
  const [message, setMessage] = useState('첫 주사위는 실드입니다. 내 보드에 놓아주세요.');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [gameNo, setGameNo] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [knockFx, setKnockFx] = useState<KnockFx | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setValue(roll()); }, []);
  useEffect(() => () => { if (animationTimer.current) clearTimeout(animationTimer.current); }, []);

  const scores = useMemo(() => ({ me: boards.me.map(rowScore), cpu: boards.cpu.map(rowScore) }), [boards]);
  const forecasts = useMemo(() => {
    if (difficulty !== 'beginner' || turn !== 'me' || choice || phase === 'over') return null;
    return boards.me.map((row, index) => projectedLineWinChance(row, boards.cpu[index], value, isShield));
  }, [boards, choice, difficulty, isShield, phase, turn, value]);
  const recommendedRow = forecasts
    ? forecasts.reduce((best, chance, index) => boards.me[index].length < 3 && chance > forecasts[best] ? index : best,
      boards.me.findIndex((row) => row.length < 3))
    : -1;

  const nextTurn = (nextBoards: { me: Board; cpu: Board }, current: Player) => {
    if (full(nextBoards.me) && full(nextBoards.cpu)) {
      setPhase('over');
      setMessage('게임 종료! 최종 결과를 확인하세요.');
      return;
    }
    let next: Player = current === 'me' ? 'cpu' : 'me';
    if (full(nextBoards[next])) next = current;
    setTurn(next);
    setPhase('place');
    setIsShield(false);
    setChoice(null);
    setValue(roll());
    setMessage(next === 'me' ? '내 차례입니다. 주사위를 놓을 줄을 선택하세요.' : `${OPPONENTS[difficulty].name}가 수를 고민하고 있습니다…`);
  };

  const place = (owner: Player, rowIndex: number) => {
    if (!['place', 'shield'].includes(phase) || turn !== 'me' || choice) return;
    const initial = boards.me.flat().length === 0 && boards.cpu.flat().length === 0;
    if ((owner !== 'me' && !isShield) || (initial && owner !== 'me') || boards[owner][rowIndex].length >= 3) return;
    const next = { me: boards.me.map((row) => [...row]) as Board, cpu: boards.cpu.map((row) => [...row]) as Board };
    const placed = { id: Date.now() + Math.random(), value, shield: isShield };
    next[owner][rowIndex].push(placed);
    let victimIds: number[] = [];
    if (!isShield && owner === 'me') {
      victimIds = next.cpu[rowIndex].filter((die) => !die.shield && die.value === value).map((die) => die.id);
    }
    setBoards(next);
    if (victimIds.length) {
      setPhase('knock');
      setKnockFx({ attacker: 'me', attackerId: placed.id, victimIds, row: rowIndex });
      setMessage(`알까기! 내 주사위가 같은 숫자 ${victimIds.length}개를 밀어냅니다.`);
      animationTimer.current = setTimeout(() => {
        const cleaned = { me: next.me.map((line) => [...line]) as Board, cpu: next.cpu.map((line) => [...line]) as Board };
        cleaned.cpu[rowIndex] = cleaned.cpu[rowIndex].filter((die) => !victimIds.includes(die.id));
        setBoards(cleaned);
        setKnockFx(null);
        setPhase('shield');
        setIsShield(true);
        setValue(roll());
        setMessage(`알까기 성공! ${victimIds.length}개 제거 · 보너스 실드를 양쪽 보드 중 골라 놓으세요.`);
      }, 760);
    } else {
      nextTurn(next, 'me');
    }
  };

  useEffect(() => {
    if (turn !== 'cpu' || phase !== 'place') return;
    const timer = setTimeout(() => {
      const next = { me: boards.me.map((row) => [...row]) as Board, cpu: boards.cpu.map((row) => [...row]) as Board };
      const openRows = next.cpu.map((row, index) => row.length < 3 ? index : -1).filter((index) => index >= 0);
      if (!openRows.length) { nextTurn(next, 'cpu'); return; }

      let cpuValue = value;
      const bestFor = (candidate: number) => Math.max(...openRows.map((row) => cpuUtility(next, row, candidate)));
      if (rerolls.cpu && difficulty !== 'beginner') {
        const fresh = roll();
        if ((difficulty === 'skilled' && cpuValue <= 2) || (difficulty === 'expert' && bestFor(fresh) > bestFor(cpuValue))) cpuValue = fresh;
        setRerolls((current) => ({ ...current, cpu: false }));
      }

      let row: number;
      if (difficulty === 'beginner') row = openRows[Math.floor(Math.random() * openRows.length)];
      else if (difficulty === 'skilled') {
        row = [...openRows].sort((a, b) => {
          const hitsA = next.me[a].filter((die) => !die.shield && die.value === cpuValue).length;
          const hitsB = next.me[b].filter((die) => !die.shield && die.value === cpuValue).length;
          return hitsB - hitsA || rowScore(next.cpu[b]) - rowScore(next.cpu[a]);
        })[0];
      } else row = [...openRows].sort((a, b) => cpuUtility(next, b, cpuValue) - cpuUtility(next, a, cpuValue))[0];

      const placed = { id: Date.now(), value: cpuValue, shield: isShield };
      next.cpu[row].push(placed);
      let victimIds: number[] = [];
      if (!isShield) {
        victimIds = next.me[row].filter((die) => !die.shield && die.value === cpuValue).map((die) => die.id);
      }
      setBoards({ me: next.me.map((line) => [...line]) as Board, cpu: next.cpu.map((line) => [...line]) as Board });
      if (victimIds.length) {
        setPhase('knock');
        setKnockFx({ attacker: 'cpu', attackerId: placed.id, victimIds, row });
        setMessage(`${OPPONENTS[difficulty].name}의 주사위가 알까기를 시도합니다!`);
        animationTimer.current = setTimeout(() => {
          const cleaned = { me: next.me.map((line) => [...line]) as Board, cpu: next.cpu.map((line) => [...line]) as Board };
          cleaned.me[row] = cleaned.me[row].filter((die) => !victimIds.includes(die.id));
          const shieldValue = roll();
          const ownRows = cleaned.cpu.map((line, index) => line.length < 3 ? index : -1).filter((index) => index >= 0);
          const yourRows = cleaned.me.map((line, index) => line.length < 3 ? index : -1).filter((index) => index >= 0);
          const target: Player = ownRows.length ? 'cpu' : 'me';
          const targetRows = target === 'cpu' ? ownRows : yourRows;
          if (targetRows.length) cleaned[target][targetRows[0]].push({ id: Date.now() + 1, value: shieldValue, shield: true });
          setBoards(cleaned);
          setKnockFx(null);
          nextTurn(cleaned, 'cpu');
        }, 760);
        return;
      }
      nextTurn(next, 'cpu');
    }, difficulty === 'beginner' ? 560 : difficulty === 'skilled' ? 760 : 980);
    return () => clearTimeout(timer);
  }, [boards, difficulty, isShield, phase, rerolls.cpu, turn, value]);

  const useReroll = () => {
    if (turn !== 'me' || !rerolls.me || phase !== 'place') return;
    setRerolls((current) => ({ ...current, me: false }));
    setChoice([value, roll()]);
    setMessage('기존 숫자와 새 숫자 중 하나를 선택하세요.');
  };

  const reset = () => {
    if (animationTimer.current) clearTimeout(animationTimer.current);
    animationTimer.current = null;
    setBoards({ me: emptyBoard(), cpu: emptyBoard() });
    setTurn('me'); setPhase('place'); setValue(roll()); setIsShield(true);
    setRerolls({ me: true, cpu: true }); setChoice(null);
    setKnockFx(null);
    setMessage('첫 주사위는 실드입니다. 내 보드에 놓아주세요.');
    setGameNo((number) => number + 1);
  };

  const changeDifficulty = (next: Difficulty) => {
    if (next === difficulty) return;
    setDifficulty(next);
    reset();
  };

  const wins = [0, 1, 2].reduce((result, index) => {
    if (scores.me[index] > scores.cpu[index]) result.me++;
    else if (scores.cpu[index] > scores.me[index]) result.cpu++;
    return result;
  }, { me: 0, cpu: 0 });
  const totals = { me: scores.me.reduce((a, b) => a + b, 0), cpu: scores.cpu.reduce((a, b) => a + b, 0) };
  const finalWinner = wins.me >= 2 ? '내 승리' : wins.cpu >= 2 ? '상대 승리' : totals.me > totals.cpu ? '내 승리' : totals.cpu > totals.me ? '상대 승리' : '무승부';
  const opponent = OPPONENTS[difficulty];

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-gem"><Sparkles /></span><div><h1>티카투카</h1><p>세 줄의 운명</p></div></div>
        <div className="round-chip">ROUND <strong>{gameNo}</strong></div>
        <nav><Button variant="ghost" size="sm" onClick={() => setRulesOpen(true)}>게임 규칙</Button><Button variant="ghost" size="icon-sm" onClick={() => setSound(!sound)} aria-label="소리 켜기/끄기">{sound ? <Volume2 /> : <VolumeX />}</Button><Button variant="ghost" size="icon-sm" onClick={reset} aria-label="새 게임"><RotateCcw /></Button></nav>
      </header>

      <section className="difficulty-bar" aria-label="상대와 난이도 선택">
        <div className="difficulty-intro"><BrainCircuit /><span>상대 선택</span></div>
        {Object.entries(OPPONENTS).map(([key, profile]) => <button key={key} className={`difficulty-option ${difficulty === key ? 'selected' : ''}`} aria-pressed={difficulty === key} onClick={() => changeDifficulty(key as Difficulty)}><img src={profile.image} alt="" /><span><small>{profile.level}</small><b>{profile.name}</b></span></button>)}
      </section>

      <section className="turn-stage"><span className={`turn-dot ${turn === 'me' ? 'mine' : ''}`} /><div><p>{turn === 'me' ? '당신의 차례' : `${opponent.name}의 차례`}</p><strong>{message}</strong></div><span className={`type-badge ${isShield ? 'shield' : ''}`}>{isShield && <Shield />}{isShield ? '실드 주사위' : '일반 주사위'}</span></section>

      <section className="table-wrap">
        <PlayerBoard owner="me" knockFx={knockFx} profile={PLAYER_PROFILE} label="나" board={boards.me} scores={scores.me} accent="teal" active={turn === 'me'} onRow={(index) => place('me', index)} canPlace={(index) => turn === 'me' && !choice && phase !== 'knock' && boards.me[index].length < 3} currentValue={value} forecasts={forecasts} recommendedRow={recommendedRow} />
        <div className="center-console"><span className="roll-label">이번 주사위</span><DieFace die={{ id: 0, value, shield: isShield }} active />{choice ? <span className="reroll-pending"><RotateCcw /> 선택 대기</span> : <Button className="reroll-btn" variant="outline" onClick={useReroll} disabled={!rerolls.me || turn !== 'me' || phase !== 'place'}><RotateCcw /> 리롤 <small>{rerolls.me ? '1회 남음' : '사용 완료'}</small></Button>}<div className="versus">VS</div></div>
        <PlayerBoard owner="cpu" knockFx={knockFx} profile={opponent} label="상대" board={boards.cpu} scores={scores.cpu} accent="coral" active={turn === 'cpu'} onRow={(index) => place('cpu', index)} canPlace={(index) => turn === 'me' && !choice && phase !== 'knock' && isShield && boards.cpu[index].length < 3 && !(boards.me.flat().length === 0 && boards.cpu.flat().length === 0)} currentValue={value} />
      </section>

      {difficulty === 'beginner' && forecasts && <aside className="coach-tip"><BrainCircuit /><div><b>루미의 추천</b><span>{recommendedRow >= 0 ? `${recommendedRow + 1}번 줄의 예상 승률이 ${forecasts[recommendedRow]}%로 가장 높아요.` : '놓을 수 있는 줄이 없습니다.'}</span></div><small>남은 일반 주사위 조합과 현재 알까기 결과를 반영한 추정치</small></aside>}
      <footer className="scorebar"><div><span>획득 라인</span><strong className="teal-text">{wins.me}</strong><i>:</i><strong className="coral-text">{wins.cpu}</strong></div><p>같은 숫자가 추가될 때마다 해당 숫자만큼 보너스</p><div><span>총점</span><strong>{totals.me}</strong><i>:</i><strong>{totals.cpu}</strong></div></footer>

      {choice && <div className="reroll-backdrop"><section className="reroll-dialog" role="dialog" aria-modal="true" aria-labelledby="reroll-title"><p className="eyebrow">ONE REROLL</p><h2 id="reroll-title">어떤 주사위를 사용할까요?</h2><p className="reroll-help">왼쪽은 굴리기 전, 오른쪽은 새로 굴린 결과입니다.</p><div className="reroll-options">{choice.map((number, index) => <button key={`${number}-${index}`} className={`reroll-option ${index ? 'fresh' : 'original'}`} aria-label={`${index ? '새로 굴린' : '기존'} 주사위 ${number} 선택`} onClick={() => { setValue(number); setChoice(null); setMessage(`${index ? '새로 굴린' : '기존'} ${number}번 주사위를 선택했습니다. 놓을 줄을 골라주세요.`); }}><span className="option-label"><small>{index ? 'REROLLED' : 'BEFORE'}</small><b>{index ? '새 주사위' : '기존 주사위'}</b></span>{index > 0 && <em className="new-ribbon">NEW</em>}<DieFace die={{ id: index, value: number, shield: isShield }} /><strong>눈 {number}</strong><span className="select-copy">이 주사위 선택</span></button>)}</div>{choice[0] === choice[1] && <p className="same-roll">같은 숫자가 나왔어요. 어느 쪽을 선택해도 결과는 같습니다.</p>}</section></div>}
      {phase === 'over' && <div className="modal-backdrop"><section className="result-card"><Sparkles /><p>게임 종료</p><h2>{finalWinner}</h2><div><span>획득 라인 {wins.me} : {wins.cpu}</span><span>총점 {totals.me} : {totals.cpu}</span></div><Button onClick={reset}>다시 대결하기</Button></section></div>}
      {rulesOpen && <div className="modal-backdrop" onClick={() => setRulesOpen(false)}><section className="rules-card" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setRulesOpen(false)} aria-label="닫기"><X /></button><p className="eyebrow">HOW TO PLAY</p><h2>게임 규칙</h2><ol><li><b>줄을 차지하세요</b><span>각 줄에 주사위를 3개까지 놓고, 3줄 중 2줄 이상 높은 점수를 만드세요.</span></li><li><b>같은 숫자 보너스</b><span>기본 합계에 같은 숫자가 추가될 때마다 해당 숫자만큼 더합니다. 예: 6·2·2는 12점입니다.</span></li><li><b>알까기</b><span>일반 주사위를 내 줄에 놓으면 상대 같은 줄의 동일 숫자 일반 주사위를 모두 제거합니다.</span></li><li><b>실드 주사위</b><span>알까기에 제거되지 않으며, 보상 실드는 양쪽 보드 어디든 놓을 수 있습니다.</span></li><li><b>세 가지 난이도</b><span>초보는 무작위 중심, 숙련은 알까기와 점수를 비교하고, 전문가는 줄의 위협도와 콤보까지 계산합니다.</span></li><li><b>초보자 승률 안내</b><span>남은 주사위 조합을 계산해 줄별 예상 승률과 추천 줄을 표시합니다.</span></li></ol></section></div>}
    </main>
  );
}

function PlayerBoard({ owner, knockFx, profile, label, board, scores, accent, active, onRow, canPlace, currentValue, forecasts, recommendedRow = -1 }: { owner: Player; knockFx: KnockFx | null; profile: Profile; label: string; board: Board; scores: number[]; accent: string; active: boolean; onRow: (index: number) => void; canPlace: (index: number) => boolean; currentValue: number; forecasts?: number[] | null; recommendedRow?: number }) {
  const dieMotion = (die: Die, rowIndex: number) => {
    if (!knockFx || knockFx.row !== rowIndex) return '';
    if (die.id === knockFx.attackerId) return knockFx.attacker === 'me' ? 'knock-attacker-right' : 'knock-attacker-left';
    if (knockFx.victimIds.includes(die.id)) return owner === 'me' ? 'knock-victim-left' : 'knock-victim-right';
    return '';
  };
  return <section className={`player-side ${accent} ${active ? 'turn-active' : ''} ${knockFx?.attacker === owner ? 'knock-source' : ''}`}><header><div className="avatar"><img src={profile.image} alt={`${profile.name} 프로필`} /></div><div><h2>{label} <span className="profile-name">{profile.name}</span></h2><p>{profile.title}</p></div>{profile.level && <em className={`level-chip level-${profile.difficulty}`}>{profile.level}</em>}<span>{active ? 'TURN' : ''}</span></header><div className="board">{board.map((row, index) => { const combo = comboMultiplier(row); const recommended = index === recommendedRow && canPlace(index); return <button key={index} className={`row ${canPlace(index) ? 'placeable' : ''} ${combo > 1 ? 'combo-row' : ''} ${recommended ? 'recommended-row' : ''} ${knockFx?.row === index ? 'knock-row' : ''}`} onClick={() => onRow(index)} disabled={!canPlace(index)} aria-label={`${index + 1}번째 줄에 놓기${forecasts ? `, 예상 승률 ${forecasts[index]}%` : ''}`}><span className="row-num">0{index + 1}</span>{recommended && <span className="recommend-badge">추천</span>}<div className="slots">{[0, 1, 2].map((slot) => row[slot] ? <DieFace key={row[slot].id} die={row[slot]} motion={dieMotion(row[slot], index)} /> : <span key={slot} className="slot">{canPlace(index) && slot === row.length ? <span className="ghost-value">{currentValue}</span> : null}</span>)}</div><div className={`row-score ${forecasts ? 'with-forecast' : ''}`}>{forecasts && <span className="line-forecast"><small>예상 승률</small><b>{forecasts[index]}%</b></span>}{combo > 1 && <em className={`combo-badge combo-${combo}`}>{combo === 3 ? 'TRIPLE' : 'DOUBLE'} BONUS</em>}<small>SCORE</small><strong>{scores[index]}</strong></div></button>; })}</div></section>;
}
