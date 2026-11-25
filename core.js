/* 화면과 분리한 타이머·보상 계산. 외부 라이브러리 없이 동작합니다. */
(function (root) {
  'use strict';
  const items = [
    { id: 'plant', name: '초록 화분', icon: '🪴', price: 30, category: 'room' },
    { id: 'scarf', name: '포근 목도리', icon: '🧣', price: 40, category: 'character', slot: 'neck' },
    { id: 'frame', name: '꽃 액자', icon: '🌷', price: 50, category: 'room' },
    { id: 'lamp', name: '작은 조명', icon: '💡', price: 60, category: 'room' },
    { id: 'hat', name: '반짝 왕관', icon: '👑', price: 100, category: 'character', slot: 'head' },
    { id: 'glasses', name: '동그란 안경', icon: '👓', price: 30, category: 'character', slot: 'face' },
    { id: 'bow', name: '작은 리본', icon: '🎀', price: 40, category: 'character', slot: 'head' },
    { id: 'shirt', name: '포근한 니트', icon: '👕', price: 60, category: 'character', slot: 'body' }
  ];
  const characters = [
    { id: 'bunny', name: '모리', species: '토끼', icon: '🐰', fur: '#fffdf3', edge: '#e5ded0' },
    { id: 'cat', name: '나비', species: '고양이', icon: '🐱', fur: '#e9b980', edge: '#bd8956' },
    { id: 'bear', name: '두리', species: '곰', icon: '🐻', fur: '#bc8e69', edge: '#916847' },
    { id: 'fox', name: '루루', species: '여우', icon: '🦊', fur: '#eaa06b', edge: '#c97949' }
  ];
  const colors = [
    { id: 'natural', name: '기본 털색' },
    { id: 'cream', name: '크림', fur: '#fff5dc', edge: '#d9c8a5' },
    { id: 'caramel', name: '카라멜', fur: '#d7a16c', edge: '#aa7546' },
    { id: 'gray', name: '구름 회색', fur: '#c8cdd7', edge: '#969eaf' },
    { id: 'pink', name: '딸기 우유', fur: '#f5c5cf', edge: '#cf94a3' },
    { id: 'mint', name: '민트', fur: '#bfe0cc', edge: '#8fb69e' }
  ];
  const expressions = [
    { id: 'smile', name: '방긋', icon: '☺' },
    { id: 'happy', name: '신나', icon: '⌒ᴗ⌒' },
    { id: 'calm', name: '차분', icon: '˘ᴗ˘' }
  ];
  const accents = [
    { id: 'rose', name: '장밋빛', color: '#cd8b6e' },
    { id: 'green', name: '숲 초록', color: '#648b70' },
    { id: 'blue', name: '하늘 파랑', color: '#709bc2' },
    { id: 'violet', name: '연보라', color: '#a68cbe' }
  ];
  function normalizeAppearance(value) {
    const input = value && typeof value === 'object' ? value : {};
    const choice = (list, id) => list.some(option => option.id === id) ? id : list[0].id;
    return { character: choice(characters, input.character), color: choice(colors, input.color),
      expression: choice(expressions, input.expression), accent: choice(accents, input.accent) };
  }
  // 저장 키와 version을 유지해 기존 포인트·구매·집중 기록을 그대로 불러옵니다.
  function initial() { return { version: 1, points: 0, owned: [], equipped: [], records: [], dailyGoal: 120, active: null, appearance: normalizeAppearance() }; }
  function dateKey(time) {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function reward(session) { return Math.floor(session.minutes * 2 * Math.max(0, 100 - session.distractions * 20) / 100); }
  // 이탈 중인 시간은 공부 시간에 포함하지 않습니다.
  function elapsed(session, now) {
    const end = session.hiddenAt ?? now;
    return Math.min(session.minutes * 60000, Math.max(0, session.elapsedMs + Math.max(0, end - session.lastStartedAt)));
  }
  function leave(session, now) {
    if (!session || session.hiddenAt !== null || elapsed(session, now) >= session.minutes * 60000) return false;
    session.elapsedMs = elapsed(session, now);
    session.lastStartedAt = now;
    session.hiddenAt = now;
    session.distractions += 1;
    return true;
  }
  function resume(session, now) {
    if (!session || session.hiddenAt === null) return;
    session.lastStartedAt = now;
    session.hiddenAt = null;
  }
  function finish(state, now, completed) {
    const s = state.active;
    if (!s) return null;
    const milliseconds = elapsed(s, now);
    // 호출자가 완료 여부를 잘못 전달해도 목표 시간 전에 보상하지 않습니다.
    completed = completed && milliseconds >= s.minutes * 60000;
    const record = { title: s.title, startedAt: s.startedAt, endedAt: now,
      minutes: milliseconds / 60000, target: s.minutes, completed,
      distractions: s.distractions, points: completed ? reward(s) : 0 };
    state.records.push(record);
    state.points += record.points;
    state.active = null;
    return record;
  }
  function purchase(state, id) {
    const item = items.find(item => item.id === id);
    if (!item) return 'invalid';
    if (!state.owned.includes(id)) {
      if (state.points < item.price) return 'insufficient';
      state.points -= item.price;
      state.owned.push(id);
      equip(state, item);
      return 'purchased';
    }
    if (state.equipped.includes(id)) {
      state.equipped = state.equipped.filter(value => value !== id);
      return 'removed';
    }
    equip(state, item);
    return 'equipped';
  }
  function equip(state, item) {
    // 왕관과 리본처럼 같은 위치의 의상은 하나만 착용합니다. 구매 내역은 유지합니다.
    if (item.slot) state.equipped = state.equipped.filter(id => items.find(value => value.id === id)?.slot !== item.slot);
    state.equipped.push(item.id);
  }
  function stats(state, now) {
    const today = new Date(now);
    const days = Array.from({length: 7}, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i);
      const key = dateKey(d);
      return { key, label: `${d.getMonth() + 1}/${d.getDate()}`, minutes: state.records.filter(r => dateKey(r.endedAt) === key).reduce((n,r) => n + r.minutes, 0) };
    });
    const recent = state.records.filter(r => dateKey(r.endedAt) >= days[0].key && dateKey(r.endedAt) <= days[6].key);
    const completed = recent.filter(r => r.completed).length;
    return { days, today: days[6].minutes, total: days.reduce((n,d) => n + d.minutes, 0), count: recent.length, completed,
      rate: recent.length ? Math.round(completed / recent.length * 100) : 0 };
  }
  const core = { items, characters, colors, expressions, accents, normalizeAppearance, initial, dateKey, reward, elapsed, leave, resume, finish, purchase, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else root.FocusCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
