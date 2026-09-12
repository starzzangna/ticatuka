import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyBoard, rowScore, getNextPlayer, getResult, placeDie, removeVictims, chooseCpuShield, shouldCpuReroll, projectedLineWinChance } from '../lib/game.ts';
import { readSave } from '../lib/game-save.ts';
let id = 0;
const die = (value, shield=false) => ({id: ++id,value,shield});
const row = (...values) => values.map(v => die(v));
const empty = () => ({me:emptyBoard(),cpu:emptyBoard()});
const full = () => [row(1,2,3),row(1,2,3),row(1,2,3)];

test('requested examples and all six double/triple values', () => {
  for (const [values, expected] of [[[6,2,2],12],[[4,4,2],14],[[6,6,5],23],[[5,5,5],25],[[6,6,6],30]]) {
    assert.equal(rowScore(row(...values)),expected);
    assert.equal(rowScore(row(...values.reverse())),expected);
  }
  for(let n=1;n<=6;n++) {
    assert.equal(rowScore(row(n,n)),n*3);
    assert.equal(rowScore(row(n,n,n)),n*5);
    assert.equal(rowScore([die(n,true),die(n)]),n*3);
  }
  assert.equal(rowScore([]),0);
  assert.equal(rowScore(row(1,2,3)),6);
});
test('knock removes every matching ordinary die only in the opposing row', () => {
  const boards=empty();
  boards.cpu[0]=[die(2),die(2),die(2,true)];
  boards.cpu[1]=row(2);
  const original=structuredClone(boards);
  const placed=placeDie(boards,'me',0,die(2));
  assert.equal(placed.victimIds.length,2);
  assert.deepEqual(boards,original);
  const cleaned=removeVictims(placed.boards,placed.victimIds);
  assert.equal(cleaned.cpu[0].length,1);
  assert.equal(cleaned.cpu[0][0].shield,true);
  assert.equal(cleaned.cpu[1].length,1);
  assert.equal(placed.boards.cpu[0].length,3);
});
test('shield placement never knocks out a matching die', () => {
  const boards=empty(); boards.me[0]=row(6);
  assert.deepEqual(placeDie(boards,'cpu',0,die(6,true)).victimIds,[]);
});
test('rejects full and invalid rows', () => {
  const boards=empty(); boards.me[0]=row(1,2,3);
  for(const index of [0,-1,3,1.5]) assert.equal(placeDie(boards,'me',index,die(4)),null);
});
test('turn alternation, skip full board, and end only when both are full', () => {
  const boards=empty();
  assert.equal(getNextPlayer(boards,'me'),'cpu');
  boards.cpu=full();
  assert.equal(getNextPlayer(boards,'me'),'me');
  boards.me=full();
  assert.equal(getNextPlayer(boards,'cpu'),null);
});
test('two lines beat total score; otherwise total score breaks ties', () => {
  const boards={me:[row(2),row(2),row(1)],cpu:[row(1),row(1),row(6,6,6)]};
  assert.equal(getResult(boards).winner,'내 승리');
  boards.me=[row(2),row(1),row(1)];
  boards.cpu=[row(1),row(3),row(1)];
  assert.equal(getResult(boards).winner,'상대 승리');
  boards.cpu=[row(1),row(2),row(1)];
  assert.equal(getResult(boards).winner,'무승부');
});
test('CPU saves reroll on a strong move and spends it on a weak move', () => {
  const boards=empty(); boards.me[0]=row(6,6); boards.cpu[0]=row(6);
  assert.equal(shouldCpuReroll(boards,6,'expert'),false);
  assert.equal(shouldCpuReroll(boards,1,'expert'),true);
  assert.equal(shouldCpuReroll(boards,1,'beginner'),false);
});
test('CPU shield compares bonuses instead of selecting the first empty row', () => {
  const boards=empty(); boards.cpu[1]=row(6,6); boards.me[0]=row(6,6,6); boards.me[2]=row(6,6,6);
  assert.deepEqual(chooseCpuShield(boards,6),{owner:'cpu',row:1,utility:12});
  boards.cpu=full();
  assert.equal(chooseCpuShield(boards,6).owner,'me');
  boards.me=full();
  assert.equal(chooseCpuShield(boards,6),null);
});
test('line estimate includes ties at half weight and returns bounded results', () => {
  assert.equal(projectedLineWinChance(row(1,2),row(1,2,3),3,true),50);
  assert.equal(projectedLineWinChance(row(6,6),row(1,2,3),6,true),100);
  assert.equal(projectedLineWinChance(row(1,1),row(6,6,6),1,true),0);
});
const save = () => ({
  version:1,boards:empty(),turn:'me',phase:'place',value:6,isShield:true,
  rerolls:{me:true,cpu:true},choice:null,difficulty:'beginner',gameNo:1,sound:true,message:'시작',
});
test('save round-trip and invalid/corrupt data rejection', () => {
  const s=save();
  assert.deepEqual(readSave(JSON.stringify(s)),s);
  for (const raw of [null,'{','null',JSON.stringify({...s,version:2}),JSON.stringify({...s,value:7}),JSON.stringify({...s,phase:'knock'}),JSON.stringify({...s,phase:'over'})]) assert.equal(readSave(raw),null);
  s.boards.me[0]=[die(4)]; s.boards.cpu[0]=[s.boards.me[0][0]];
  assert.equal(readSave(JSON.stringify(s)),null);
});
test('reroll and shield turns survive save/restore', () => {
  const s=save();s.rerolls.me=false;s.choice=[6,2];
  assert.deepEqual(readSave(JSON.stringify(s)).choice,[6,2]);
  s.choice=null;s.phase='shield';
  assert.equal(readSave(JSON.stringify(s)).phase,'shield');
});
