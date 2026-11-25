'use strict';
const C = window.FocusCore;
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'focus-room-v1';
let state = C.initial();
let toastTimeout;
let audio;
let storageWarning = false;
let shopCategory = 'character';
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (saved.version === 1 && Number.isFinite(saved.points) && saved.points >= 0 && Array.isArray(saved.records) && Array.isArray(saved.owned) && Array.isArray(saved.equipped)) {
      state = { ...state, ...saved };
    }
  }
} catch { storageWarning = true; }
state.appearance = C.normalizeAppearance(state.appearance);

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 5000);
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { if (!storageWarning) { storageWarning = true; toast('브라우저 저장 공간을 사용할 수 없어 이번 기록이 저장되지 않을 수 있어요.'); } }
}
function formatMinutes(value) { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
function drawCharacter() {
  const appearance = state.appearance;
  const character = C.characters.find(value => value.id === appearance.character);
  const color = C.colors.find(value => value.id === appearance.color);
  const accent = C.accents.find(value => value.id === appearance.accent);
  const expression = C.expressions.find(value => value.id === appearance.expression);
  const figure = $('character');
  figure.dataset.character = character.id;
  figure.dataset.expression = expression.id;
  figure.style.setProperty('--fur', color.fur || character.fur);
  figure.style.setProperty('--fur-edge', color.edge || character.edge);
  figure.style.setProperty('--outfit-color', accent.color);
  $('room-heading').textContent = `${character.name}의 작은 방`;
  $('character-avatar').textContent = character.icon;
  $('character-caption').textContent = `${character.name}의 한마디`;
  document.querySelectorAll('[data-decoration]').forEach(el => { el.hidden = !state.equipped.includes(el.dataset.decoration); });
  document.querySelectorAll('[data-appearance]').forEach(button => {
    button.setAttribute('aria-pressed', String(appearance[button.dataset.appearance] === button.dataset.value));
    if (button.dataset.appearance === 'color' && button.dataset.value === 'natural') button.style.setProperty('--swatch', character.fur);
  });
  const decorated = C.items.filter(item => state.equipped.includes(item.id)).map(item => item.name);
  $('room').setAttribute('aria-label', `책상에서 공부하는 ${character.species} ${character.name}의 방. ${color.name}, ${expression.name} 표정, 의상 색 ${accent.name}${decorated.length ? '. 착용·배치한 아이템: ' + decorated.join(', ') : ''}`);
}
function setupStudio() {
  const groups = [
    ['character-choices', 'character', C.characters], ['color-choices', 'color', C.colors],
    ['expression-choices', 'expression', C.expressions], ['accent-choices', 'accent', C.accents]
  ];
  groups.forEach(([container, key, options]) => {
    $(container).replaceChildren(...options.map(option => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.appearance = key; button.dataset.value = option.id;
      button.setAttribute('aria-label', option.species ? `${option.species} ${option.name}` : option.name);
      button.title = option.name;
      if (key === 'color' || key === 'accent') {
        button.className = 'swatch'; button.style.setProperty('--swatch', option.fur || option.color || C.characters[0].fur);
        const check = document.createElement('span'); check.textContent = '✓'; check.setAttribute('aria-hidden', 'true'); button.append(check);
        if (key === 'color' && option.id === 'natural') button.classList.add('natural-swatch');
      } else {
        const icon = document.createElement('span'); icon.className = 'choice-icon'; icon.textContent = option.icon; icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = option.species ? `${option.name} · ${option.species}` : option.name;
        button.append(icon, label);
      }
      button.addEventListener('click', () => {
        state.appearance = C.normalizeAppearance({ ...state.appearance, [key]: option.id });
        save(); drawCharacter();
        toast(key === 'character' ? `${option.name}와 함께 집중해요!` : `${option.name}${key === 'expression' ? ' 표정' : ''}으로 바꿨어요.`);
      });
      return button;
    }));
  });
  document.querySelectorAll('[data-shop-category]').forEach(button => button.addEventListener('click', () => {
    shopCategory = button.dataset.shopCategory;
    document.querySelectorAll('[data-shop-category]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    drawShop();
  }));
}
function drawShop() {
  const focusedItem = document.activeElement?.dataset.item;
  $('balance').textContent = state.points.toLocaleString('ko-KR');
  $('shop').replaceChildren(...C.items.filter(item => item.category === shopCategory).map(item => {
    const button = document.createElement('button');
    const owned = state.owned.includes(item.id);
    const equipped = state.equipped.includes(item.id);
    button.type = 'button';
    button.dataset.item = item.id;
    button.className = equipped ? 'equipped' : '';
    const verb = item.category === 'character' ? '착용' : '배치';
    button.setAttribute('aria-label', `${item.name}, ${owned ? (equipped ? `${verb} 해제` : `${verb}하기`) : `${item.price} 포인트로 구매`}`);
    if (owned) button.setAttribute('aria-pressed', String(equipped));
    for (const [className, text] of [['item-icon', item.icon], ['item-name', item.name], ['price', owned ? (equipped ? `${verb} 중 ✓` : `${verb}하기`) : `${item.price} P`]]) {
      const span = document.createElement('span'); span.className = className; span.textContent = text; button.append(span);
    }
    button.addEventListener('click', () => {
      const result = C.purchase(state, item.id);
      if (result === 'insufficient') return toast(`${item.name} 구매까지 ${item.price - state.points}P 더 필요해요. 집중해서 모아볼까요?`);
      save(); drawShop();
      toast(result === 'purchased' ? `${item.name} 구매 완료! 바로 ${verb}했어요.` : result === 'removed' ? `${item.name} 보관 완료!` : `${item.name} ${verb} 완료!`);
    });
    return button;
  }));
  if (focusedItem) document.querySelector(`[data-item="${focusedItem}"]`)?.focus();
  drawCharacter();
}
function drawStats() {
  const stats = C.stats(state, Date.now());
  const percent = Math.round(stats.today / state.dailyGoal * 100);
  $('today-time').textContent = formatMinutes(Math.round(stats.today * 10) / 10);
  $('daily-percent').textContent = `${percent}%`;
  $('daily-progress').value = Math.min(percent, 100);
  $('daily-text').textContent = percent >= 100 ? '오늘의 목표 달성! 정말 잘했어요.' : `하루 목표 ${state.dailyGoal}분까지 ${formatMinutes(Math.ceil(Math.max(0, state.dailyGoal - stats.today)))}분 남았어요.`;
  $('week-total').textContent = `총 ${formatMinutes(Math.round(stats.total * 10) / 10)}분`;
  $('success-rate').replaceChildren(document.createTextNode(String(stats.rate)), Object.assign(document.createElement('span'), {textContent:'%'}));
  $('session-count').textContent = `완료한 집중 ${stats.completed} / ${stats.count}회`;
  const max = Math.max(1, ...stats.days.map(day => day.minutes));
  $('chart').replaceChildren(...stats.days.map(day => {
    const column = document.createElement('div'); column.className = 'chart-day';
    const value = document.createElement('span'); value.className = 'bar-value'; value.textContent = formatMinutes(Math.round(day.minutes * 10) / 10);
    const track = document.createElement('div'); track.className = 'bar-track';
    const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = `${day.minutes / max * 100}%`;
    const label = document.createElement('span'); label.textContent = day.label;
    track.append(bar); column.append(value, track, label); column.setAttribute('aria-label', `${day.label}, ${value.textContent}분`);
    return column;
  }));
  $('history').replaceChildren();
  if (!state.records.length) {
    const li = document.createElement('li'); li.textContent = '아직 기록이 없어요. 첫 집중을 시작해 보세요!'; $('history').append(li);
  }
  [...state.records].reverse().slice(0, 20).forEach(record => {
    const li = document.createElement('li');
    const title = document.createElement('span'); title.className = 'history-title'; title.textContent = record.title;
    const date = document.createElement('small'); date.textContent = new Date(record.endedAt).toLocaleString('ko-KR', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const detail = document.createElement('span'); detail.textContent = `${formatMinutes(Math.round(record.minutes * 10) / 10)}분 · ${record.completed ? '완료' : '중도 종료'} · +${record.points}P`;
    li.append(title, date, detail); $('history').append(li);
  });
}
function selectedMinutes() { return Number($('minutes').value); }
function renderTimer() {
  const s = state.active;
  const minutes = s ? s.minutes : selectedMinutes();
  const valid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 180;
  const elapsed = s ? C.elapsed(s, Date.now()) : 0;
  const seconds = Math.ceil(Math.max(0, (valid ? minutes : 30) * 60000 - elapsed) / 1000);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('countdown').textContent = time;
  $('timer-ring').style.setProperty('--angle', `${s ? elapsed / (s.minutes * 60000) * 360 : 0}deg`);
  $('reward').textContent = `완료하면 +${s ? C.reward(s) : valid ? minutes * 2 : 0} P`;
  $('timer-caption').textContent = s ? `이탈 ${s.distractions}회 · ${Math.max(0,100 - s.distractions * 20)}% 보상` : '온전히 나에게 집중하는 시간';
  $('session-status').textContent = s ? (s.hiddenAt !== null ? '잠시 멈춤' : '차곡차곡 집중 중') : '시작할 준비 완료';
  document.title = s ? `${time} · 몰입의 방` : '몰입의 방 · 나의 작은 집중 습관';
  if (s && elapsed >= s.minutes * 60000) complete();
}
function lockForm() {
  const running = !!state.active;
  $('goal').disabled = running;
  $('minutes').disabled = running;
  document.querySelectorAll('[data-minutes]').forEach(el => { el.disabled = running; });
  $('start').hidden = running;
  $('stop').hidden = !running;
}
function chime() {
  if (!audio || audio.state !== 'running') return;
  try {
    [523.25, 659.25, 783.99].forEach((frequency, i) => {
      const osc = audio.createOscillator(); const gain = audio.createGain();
      osc.connect(gain); gain.connect(audio.destination); osc.frequency.value = frequency;
      const start = audio.currentTime + i * .16;
      gain.gain.setValueAtTime(.08, start); gain.gain.exponentialRampToValueAtTime(.001, start + .5);
      osc.start(start); osc.stop(start + .5);
    });
  } catch { /* 소리가 지원되지 않아도 화면으로 완료를 안내합니다. */ }
}
function complete() {
  const record = C.finish(state, Date.now(), true);
  if (!record) return;
  if ($('stop-dialog').open) $('stop-dialog').close();
  save(); lockForm(); drawShop(); drawStats(); renderTimer(); chime();
  $('encouragement').textContent = `“${record.target}분 해냈어! 우리 정말 멋지다.”`;
  $('mori-message').textContent = `집중 완료! ${record.points}P로 내 의상과 방을 꾸며줄래?`;
  toast(`목표 달성! ${record.target}분 집중하고 ${record.points}P를 받았어요.`);
}
$('focus-form').addEventListener('submit', event => {
  event.preventDefault();
  if (state.active || !document.getElementById('focus-form').reportValidity()) return;
  const minutes = selectedMinutes();
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return;
  const now = Date.now();
  state.active = { title: $('goal').value.trim() || '나를 위한 집중', minutes, startedAt: now, lastStartedAt: now, elapsedMs: 0, distractions: 0, hiddenAt: null };
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); } catch { /* 선택적 완료음 */ }
  save(); lockForm(); renderTimer();
  $('encouragement').textContent = '“지금은 이 한 가지에만. 내가 옆에 있을게!”';
  $('mori-message').textContent = '쉿, 지금은 함께 집중하는 시간!';
});
document.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
  $('minutes').value = button.dataset.minutes;
  document.querySelectorAll('[data-minutes]').forEach(el => el.classList.toggle('selected', el === button));
  renderTimer();
}));
$('minutes').addEventListener('input', () => {
  document.querySelectorAll('[data-minutes]').forEach(el => el.classList.toggle('selected', Number(el.dataset.minutes) === selectedMinutes()));
  renderTimer();
});
$('daily-goal').addEventListener('change', () => {
  if (!$('daily-goal').checkValidity()) { $('daily-goal').reportValidity(); $('daily-goal').value = state.dailyGoal; return; }
  state.dailyGoal = Number($('daily-goal').value); save(); drawStats();
});
$('stop').addEventListener('click', () => $('stop-dialog').showModal());
$('keep-going').addEventListener('click', () => $('stop-dialog').close());
$('confirm-stop').addEventListener('click', () => {
  if (state.active && C.elapsed(state.active, Date.now()) >= state.active.minutes * 60000) { complete(); return; }
  C.finish(state, Date.now(), false); $('stop-dialog').close(); save(); lockForm(); drawStats(); renderTimer();
  $('encouragement').textContent = '“괜찮아. 잠깐 쉬고 다시 시작하자!”';
  $('mori-message').textContent = '오늘의 노력도 차곡차곡 기록해뒀어.';
  toast('집중을 종료했어요. 공부한 시간은 기록에 남겼어요.');
});
function handleLeave() {
  if (!state.active) return;
  if (C.elapsed(state.active, Date.now()) >= state.active.minutes * 60000) { complete(); return; }
  if (C.leave(state.active, Date.now())) save();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) handleLeave();
  else if (state.active) {
    C.resume(state.active, Date.now()); save(); renderTimer();
    $('encouragement').textContent = '“다시 돌아왔구나! 남은 시간도 함께 해보자.”';
    toast(`화면 이탈 ${state.active.distractions}회 · 예상 보상 ${C.reward(state.active)}P. 이탈 중에는 타이머가 멈춰요.`);
  }
});
// 새로고침과 페이지 종료도 같은 이탈 1회로 처리합니다.
window.addEventListener('pagehide', handleLeave);
window.addEventListener('pageshow', event => {
  if (event.persisted && state.active) { C.resume(state.active, Date.now()); save(); renderTimer(); }
});
if (state.active) {
  const s = state.active;
  if (![s.minutes, s.startedAt, s.lastStartedAt, s.elapsedMs, s.distractions].every(Number.isFinite) || s.minutes < 1 || s.minutes > 180) state.active = null;
  else {
    // 종료 이벤트가 실행되지 않은 비정상 종료는 마지막 저장 시점부터 다시 시작합니다.
    if (s.hiddenAt === null) { s.distractions += 1; s.lastStartedAt = Date.now(); }
    else if (!document.hidden) C.resume(s, Date.now());
    $('goal').value = s.title; $('minutes').value = s.minutes;
    toast('진행 중이던 집중을 이어갈게요. 화면 밖 시간은 집중에 포함하지 않아요.');
  }
}
$('daily-goal').value = state.dailyGoal;
setupStudio(); drawShop(); drawStats(); lockForm(); renderTimer(); save();
if (storageWarning) toast('브라우저 저장 데이터를 읽을 수 없어 새 기록으로 시작했어요.');
setInterval(() => {
  renderTimer();
  // 비정상 종료 시 잃는 시간을 줄이기 위한 체크포인트.
  if (state.active && state.active.hiddenAt === null && !document.hidden) {
    const now = Date.now(); state.active.elapsedMs = C.elapsed(state.active, now); state.active.lastStartedAt = now; save();
  }
}, 1000);
