'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, RotateCcw, Shield, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameModal } from '@/components/game-modal';
import { useGameSound } from '@/hooks/use-game-sound';
import { SAVE_KEY, readSave } from '@/lib/game-save';
import { emptyBoard, roll, rowScore, comboMultiplier, projectedLineWinChance, cpuUtility, getNextPlayer, getResult, placeDie, removeVictims, shouldCpuReroll, chooseCpuShield } from '@/lib/game';
import type { Die, Board, Player, Phase, Difficulty } from '@/lib/game';

type Profile = { name: string; title: string; image: string; difficulty?: Difficulty; level?: string };
type KnockFx = { attacker: Player; attackerId: number; victimIds: number[]; row: number };

const PLAYER_PROFILE: Profile = { name: '루미', title: '룬 탐험가', image: '/profiles/lumi.webp' };
const OPPONENTS: Record<Difficulty, Profile> = {
  beginner: { name: '모모', title: '주사위 견습생', image: '/profiles/momo.webp', difficulty: 'beginner', level: '초보' },
  skilled: { name: '카인', title: '주사위 사냥꾼', image: '/profiles/kain.webp', difficulty: 'skilled', level: '숙련' },
  expert: { name: '베라', title: '룬 마스터', image: '/profiles/vera.webp', difficulty: 'expert', level: '전문가' },
};

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

  const [ready, setReady] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);
  const [resultOpen, setResultOpen] = useState(true);
  const playSound = useGameSound(sound);
  useEffect(() => {
    const timer = setTimeout(() => {
      let saved = null;
      try { saved = readSave(localStorage.getItem(SAVE_KEY)); } catch { /* Storage may be disabled. */ }
      if (saved) {
        setBoards(saved.boards); setTurn(saved.turn); setPhase(saved.phase);
        setValue(saved.value); setIsShield(saved.isShield); setRerolls(saved.rerolls);
        setChoice(saved.choice); setDifficulty(saved.difficulty); setGameNo(saved.gameNo);
        setSound(saved.sound); setMessage(saved.message);
      } else setValue(roll());
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready || phase === 'knock') return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 1, boards, turn, phase, value, isShield, rerolls, choice, difficulty, gameNo, sound, message,
    })); } catch { /* Continue playing if storage is unavailable. */ }
  }, [ready, boards, turn, phase, value, isShield, rerolls, choice, difficulty, gameNo, sound, message]);
  useEffect(() => () => { if (animationTimer.current) clearTimeout(animationTimer.current); }, []);

  const scores = useMemo(() => ({ me: boards.me.map(rowScore), cpu: boards.cpu.map(rowScore) }), [boards]);
  const forecasts = useMemo(() => {
    if (!ready || difficulty !== 'beginner' || turn !== 'me' || choice || !['place','shield'].includes(phase)) return null;
    return boards.me.map((row, index) => projectedLineWinChance(row, boards.cpu[index], value, isShield));
  }, [ready, boards, choice, difficulty, isShield, phase, turn, value]);
  const recommendedRow = forecasts
    ? forecasts.reduce((best, chance, index) => boards.me[index].length < 3 && chance > forecasts[best] ? index : best,
      boards.me.findIndex((row) => row.length < 3))
    : -1;

  const nextTurn = useCallback((nextBoards: { me: Board; cpu: Board }, current: Player) => {
    const next = getNextPlayer(nextBoards, current);
    if (next === null) {
      setPhase('over');
      setMessage('게임 종료! 최종 결과를 확인하세요.');
      return;
    }
    setTurn(next);
    setPhase('place');
    setIsShield(false);
    setChoice(null);
    setValue(roll());
    setMessage(next === 'me' ? '내 차례입니다. 주사위를 놓을 줄을 선택하세요.' : `${OPPONENTS[difficulty].name}가 수를 고민하고 있습니다…`);
  }, [difficulty]);

  const place = (owner: Player, rowIndex: number) => {
    if (!ready || !['place', 'shield'].includes(phase) || turn !== 'me' || choice) return;
    const initial = boards.me.flat().length === 0 && boards.cpu.flat().length === 0;
    if ((owner !== 'me' && !isShield) || (initial && owner !== 'me') || boards[owner][rowIndex].length >= 3) return;
    const placed = { id: Date.now() + Math.random(), value, shield: isShield };
    const placement = placeDie(boards, owner, rowIndex, placed);
    if (!placement) return;
    const { boards: next, victimIds } = placement;
    playSound(victimIds.length ? 'knock' : 'place');
    setBoards(next);
    if (victimIds.length) {
      setPhase('knock');
      setKnockFx({ attacker: 'me', attackerId: placed.id, victimIds, row: rowIndex });
      setMessage(`알까기! 내 주사위가 같은 숫자 ${victimIds.length}개를 밀어냅니다.`);
      animationTimer.current = setTimeout(() => {
        const cleaned = removeVictims(next, victimIds);
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
    if (!ready || rulesOpen || pendingDifficulty || turn !== 'cpu' || phase !== 'place') return;
    const timer = setTimeout(() => {
      const next = { me: boards.me.map((row) => [...row]) as Board, cpu: boards.cpu.map((row) => [...row]) as Board };
      const openRows = next.cpu.map((row, index) => row.length < 3 ? index : -1).filter((index) => index >= 0);
      if (!openRows.length) { nextTurn(next, 'cpu'); return; }

      let cpuValue = value;
      const bestFor = (candidate: number) => Math.max(...openRows.map((row) => cpuUtility(next, row, candidate)));
      if (rerolls.cpu && shouldCpuReroll(next, cpuValue, difficulty)) {
        const fresh = roll();
        if (bestFor(fresh) > bestFor(cpuValue)) cpuValue = fresh;
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

      const placed = { id: Date.now() + Math.random(), value: cpuValue, shield: isShield };
      const placement = placeDie(next, 'cpu', row, placed);
      if (!placement) return;
      const { boards: placedBoards, victimIds } = placement;
      setBoards(placedBoards);
      playSound(victimIds.length ? 'knock' : 'place');
      if (victimIds.length) {
        setPhase('knock');
        setKnockFx({ attacker: 'cpu', attackerId: placed.id, victimIds, row });
        setMessage(`${OPPONENTS[difficulty].name}의 주사위가 알까기를 시도합니다!`);
        animationTimer.current = setTimeout(() => {
          const cleaned = removeVictims(placedBoards, victimIds);
          const shieldValue = roll();
          const target = chooseCpuShield(cleaned, shieldValue);
          if (target) cleaned[target.owner][target.row].push({ id: Date.now() + Math.random(), value: shieldValue, shield: true });
          setBoards(cleaned);
          setKnockFx(null);
          nextTurn(cleaned, 'cpu');
        }, 760);
        return;
      }
      nextTurn(placedBoards, 'cpu');
    }, difficulty === 'beginner' ? 560 : difficulty === 'skilled' ? 760 : 980);
    return () => clearTimeout(timer);
  }, [ready, rulesOpen, pendingDifficulty, boards, difficulty, isShield, phase, rerolls.cpu, turn, value, nextTurn, playSound]);

  const useReroll = () => {
    if (turn !== 'me' || !rerolls.me || phase !== 'place') return;
    setRerolls((current) => ({ ...current, me: false }));
    setChoice([value, roll()]);
    playSound('roll');
    setMessage('기존 숫자와 새 숫자 중 하나를 선택하세요.');
  };

  const reset = () => {
    if (animationTimer.current) clearTimeout(animationTimer.current);
    animationTimer.current = null;
    setBoards({ me: emptyBoard(), cpu: emptyBoard() });
    setTurn('me'); setPhase('place'); setValue(roll()); setIsShield(true);
    setRerolls({ me: true, cpu: true }); setChoice(null);
    setKnockFx(null);
    setResultOpen(true);
    setMessage('첫 주사위는 실드입니다. 내 보드에 놓아주세요.');
    setGameNo((number) => number + 1);
  };

  const changeDifficulty = (next: Difficulty) => {
    if (next === difficulty) return;
    if (boards.me.some(row => row.length) || boards.cpu.some(row => row.length)) {
      setPendingDifficulty(next); return;
    }
    setDifficulty(next); reset();
  };

  const { wins, totals, winner: finalWinner } = getResult(boards);
  const opponent = OPPONENTS[difficulty];

  return (
    <main className="game-shell" aria-busy={!ready}>
      <header className="topbar">
        <div className="brand"><span className="brand-gem"><Sparkles /></span><div><h1>티카투카</h1><p>세 줄의 운명</p></div></div>
        <div className="round-chip">ROUND <strong>{gameNo}</strong></div>
        <nav><Button variant="ghost" size="sm" onClick={() => setRulesOpen(true)}>게임 규칙</Button><Button variant="ghost" size="icon-sm" onClick={() => setSound(!sound)} aria-pressed={sound} aria-label={sound ? "소리 끄기" : "소리 켜기"}>{sound ? <Volume2 /> : <VolumeX />}</Button><Button variant="ghost" size="icon-sm" onClick={reset} aria-label="새 게임"><RotateCcw /></Button></nav>
      </header>

      <section className="difficulty-bar" aria-label="상대와 난이도 선택">
        <div className="difficulty-intro"><BrainCircuit /><span>상대 선택</span></div>
        {Object.entries(OPPONENTS).map(([key, profile]) => <button key={key} className={`difficulty-option ${difficulty === key ? 'selected' : ''}`} aria-label={`${profile.level} ${profile.name} 선택`} aria-pressed={difficulty === key} onClick={() => changeDifficulty(key as Difficulty)}><img src={profile.image} alt="" /><span><small>{profile.level}</small><b>{profile.name}</b></span></button>)}
      </section>

      <section className="turn-stage" aria-live="polite" aria-atomic="true"><span className={`turn-dot ${turn === 'me' ? 'mine' : ''}`} /><div><p>{turn === 'me' ? '당신의 차례' : `${opponent.name}의 차례`}</p><strong>{message}</strong></div><span className={`type-badge ${isShield ? 'shield' : ''}`}>{isShield && <Shield />}{isShield ? '실드 주사위' : '일반 주사위'}</span></section>

      <section className="table-wrap">
        <PlayerBoard owner="me" knockFx={knockFx} profile={PLAYER_PROFILE} label="나" board={boards.me} scores={scores.me} accent="teal" active={turn === 'me'} onRow={(index) => place('me', index)} canPlace={(index) => ready && turn === 'me' && !choice && ['place','shield'].includes(phase) && boards.me[index].length < 3} currentValue={value} forecasts={forecasts} recommendedRow={recommendedRow} />
        <div className="center-console"><span className="roll-label">이번 주사위</span><DieFace die={{ id: 0, value, shield: isShield }} active />{choice ? <span className="reroll-pending"><RotateCcw /> 선택 대기</span> : <Button className="reroll-btn" variant="outline" onClick={useReroll} aria-label="주사위 다시 굴리기" disabled={!ready || !rerolls.me || turn !== 'me' || phase !== 'place'}><RotateCcw /> 리롤 <small>{rerolls.me ? '1회 남음' : '사용 완료'}</small></Button>}<div className="versus">VS</div></div>
        <PlayerBoard owner="cpu" knockFx={knockFx} profile={opponent} label="상대" board={boards.cpu} scores={scores.cpu} accent="coral" active={turn === 'cpu'} onRow={(index) => place('cpu', index)} canPlace={(index) => ready && turn === 'me' && !choice && ['place','shield'].includes(phase) && isShield && boards.cpu[index].length < 3 && !(boards.me.flat().length === 0 && boards.cpu.flat().length === 0)} currentValue={value} />
      </section>

      {difficulty === 'beginner' && forecasts && <aside className="coach-tip"><BrainCircuit /><div><b>루미의 추천</b><span>{recommendedRow >= 0 ? `${recommendedRow + 1}번 줄의 줄 우세도가 ${forecasts[recommendedRow]}%로 가장 높아요.` : '놓을 수 있는 줄이 없습니다.'}</span></div><small>빈칸을 무작위로 채운 추정치 · 무승부는 절반 반영 · 이후 알까기와 상대 전략 제외</small></aside>}
      <footer className="scorebar"><div><span>획득 라인</span><strong className="teal-text">{wins.me}</strong><i>:</i><strong className="coral-text">{wins.cpu}</strong></div><p>같은 숫자가 추가될 때마다 해당 숫자만큼 보너스</p><div><span>총점</span><strong>{totals.me}</strong><i>:</i><strong>{totals.cpu}</strong></div></footer>

      {choice && <GameModal open onClose={() => { setValue(choice[0]); setChoice(null); setMessage('기존 주사위를 선택했습니다. 놓을 줄을 골라주세요.'); }} title="어떤 주사위를 사용할까요?" className="reroll-dialog"><p className="eyebrow">ONE REROLL</p><p className="reroll-help">왼쪽은 굴리기 전, 오른쪽은 새로 굴린 결과입니다.</p><div className="reroll-options">{choice.map((number, index) => <button key={`${number}-${index}`} className={`reroll-option ${index ? 'fresh' : 'original'}`} aria-label={`${index ? '새로 굴린' : '기존'} 주사위 ${number} 선택`} onClick={() => { setValue(number); setChoice(null); setMessage(`${index ? '새로 굴린' : '기존'} ${number}번 주사위를 선택했습니다. 놓을 줄을 골라주세요.`); }}><span className="option-label"><small>{index ? 'REROLLED' : 'BEFORE'}</small><b>{index ? '새 주사위' : '기존 주사위'}</b></span>{index > 0 && <em className="new-ribbon">NEW</em>}<DieFace die={{ id: index, value: number, shield: isShield }} /><strong>눈 {number}</strong><span className="select-copy">이 주사위 선택</span></button>)}</div>{choice[0] === choice[1] && <p className="same-roll">같은 숫자가 나왔어요. 어느 쪽을 선택해도 결과는 같습니다.</p>}</GameModal>}
      {phase === 'over' && <GameModal open={resultOpen} onClose={() => setResultOpen(false)} title={finalWinner} className="result-card"><Sparkles /><p>게임 종료</p><div><span>획득 라인 {wins.me} : {wins.cpu}</span><span>총점 {totals.me} : {totals.cpu}</span></div><Button onClick={reset}>다시 대결하기</Button></GameModal>}
      {rulesOpen && <GameModal open onClose={() => setRulesOpen(false)} title="게임 규칙" className="rules-card"><button className="close" onClick={() => setRulesOpen(false)} aria-label="닫기"><X /></button><p className="eyebrow">HOW TO PLAY</p><ol><li><b>줄을 차지하세요</b><span>양쪽 보드가 모두 차면 종료합니다. 가득 찬 보드는 차례를 건너뜁니다. 2줄을 이기면 승리하고, 해당자가 없으면 총점으로 결정합니다. 총점도 같으면 무승부입니다.</span></li><li><b>같은 숫자 보너스</b><span>기본 합계에 같은 숫자가 추가될 때마다 해당 숫자만큼 더합니다. 예: 6·2·2는 12점, 6·6·6은 30점입니다.</span></li><li><b>알까기</b><span>일반 주사위를 내 줄에 놓으면 상대 같은 줄의 동일 숫자 일반 주사위를 모두 제거합니다.</span></li><li><b>실드 주사위</b><span>알까기에 제거되지 않으며, 보상 실드는 양쪽 보드 어디든 놓을 수 있습니다.</span></li><li><b>세 가지 난이도</b><span>초보는 무작위 중심, 숙련은 알까기와 점수를 비교하고, 전문가는 줄의 위협도와 콤보까지 계산합니다.</span></li><li><b>초보자 승률 안내</b><span>현재 배치 후 빈칸을 무작위로 채웠을 때의 줄 우세도를 표시합니다. 무승부는 절반 반영하며, 이후 알까기·실드 보상·상대 전략은 반영하지 않습니다. 실제 승률과 다릅니다.</span></li></ol></GameModal>}
      <GameModal open={pendingDifficulty !== null} onClose={() => setPendingDifficulty(null)} title="상대를 변경할까요?" className="rules-card">
        <p>진행 중인 게임이 초기화됩니다.</p>
        <div className="confirm-actions"><Button variant="outline" onClick={() => setPendingDifficulty(null)}>계속하기</Button><Button onClick={() => { if (pendingDifficulty) { setDifficulty(pendingDifficulty); reset(); setPendingDifficulty(null); } }}>변경하고 새 게임</Button></div>
      </GameModal>
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
  return <section className={`player-side ${accent} ${active ? 'turn-active' : ''} ${knockFx?.attacker === owner ? 'knock-source' : ''}`}><header><div className="avatar"><img src={profile.image} alt={`${profile.name} 프로필`} /></div><div><h2>{label} <span className="profile-name">{profile.name}</span></h2><p>{profile.title}</p></div>{profile.level && <em className={`level-chip level-${profile.difficulty}`}>{profile.level}</em>}<span>{active ? 'TURN' : ''}</span></header><div className="board">{board.map((row, index) => { const combo = comboMultiplier(row); const recommended = index === recommendedRow && canPlace(index); return <button key={index} className={`row ${canPlace(index) ? 'placeable' : ''} ${combo > 1 ? 'combo-row' : ''} ${recommended ? 'recommended-row' : ''} ${knockFx?.row === index ? 'knock-row' : ''}`} onClick={() => onRow(index)} disabled={!canPlace(index)} aria-label={`${index + 1}번째 줄에 놓기${forecasts ? `, 줄 우세도 ${forecasts[index]}%` : ''}`}><span className="row-num">0{index + 1}</span>{recommended && <span className="recommend-badge">추천</span>}<div className="slots">{[0, 1, 2].map((slot) => row[slot] ? <DieFace key={row[slot].id} die={row[slot]} motion={dieMotion(row[slot], index)} /> : <span key={slot} className="slot">{canPlace(index) && slot === row.length ? <span className="ghost-value">{currentValue}</span> : null}</span>)}</div><div className={`row-score ${forecasts ? 'with-forecast' : ''}`}>{forecasts && <span className="line-forecast"><small>줄 우세도</small><b>{forecasts[index]}%</b></span>}{combo > 1 && <em className={`combo-badge combo-${combo}`}>{combo === 3 ? 'TRIPLE' : 'DOUBLE'} BONUS</em>}<small>SCORE</small><strong>{scores[index]}</strong></div></button>; })}</div></section>;
}
