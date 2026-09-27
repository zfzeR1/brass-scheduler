import { deflate, inflate } from 'pako';
import type {
  ScheduleState,
  Room,
  Song,
  DuplicateNGPair,
  Entry,
  Assignment,
  InstrumentMovement
} from '../types';
import { STANDARD_INSTRUMENTS } from '../types';

// --- Base64url ユーティリティ (URLセーフ, +/= を使わない) ---
export function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// --- ミニファイ: ScheduleState → 軽量ペイロード ---
export interface MiniPayload {
  t: { s: string; e: string; d: number; i: number };
  r: Array<{ id: string; n: string; c: number; p?: 1; pi?: string }>;
  s: Array<{ id: string; n: string; p: Record<string, number> }>;
  e: Array<{ id: string; sId: string; s: string; pr: string; p: Array<[string, number]> }>;
  a: Array<{ s: number; r: string; e?: string; pp?: 1; pt?: Array<{ i: string; pi: number; sId?: string }>; l?: 1 }>;
  ng: Array<{ id: string; a: [string, string, number]; b: [string, string, number] }>;
  inst?: Array<{ id: string; n: string; m: InstrumentMovement }>;
}

export function minifyState(data: ScheduleState): MiniPayload {
  const mini: MiniPayload = {
    t: {
      s: data.timeSettings.startTime,
      e: data.timeSettings.endTime,
      d: data.timeSettings.slotDuration,
      i: data.timeSettings.intervalDuration
    },
    r: data.rooms.map(r => {
      const rm: MiniPayload['r'][0] = { id: r.id, n: r.name, c: r.capacity };
      if (r.isPersonalPracticeCandidate) rm.p = 1;
      if (r.permanentInstrumentId) rm.pi = r.permanentInstrumentId;
      return rm;
    }),
    s: data.songs.map(s => ({ id: s.id, n: s.name, p: s.parts })),
    e: data.entries.map(e => ({
      id: e.id,
      sId: e.songId,
      s: e.section,
      pr: e.priority,
      p: e.parts.map(p => [p.instrumentId, p.partIndex] as [string, number])
    })),
    // 空き部屋かつ未ロック枠は除外してデータ量を削減
    a: data.assignments
      .filter(a => a.entryId || a.isPersonalPractice || a.isLocked)
      .map(a => {
        const item: MiniPayload['a'][0] = { s: a.slotIndex, r: a.roomId };
        if (a.entryId) item.e = a.entryId;
        if (a.isPersonalPractice) item.pp = 1;
        if (a.isLocked) item.l = 1;
        if (a.parts && a.parts.length > 0) {
          item.pt = a.parts.map(p => {
            const pt: { i: string; pi: number; sId?: string } = { i: p.instrumentId, pi: p.partIndex };
            if (p.songId) pt.sId = p.songId;
            return pt;
          });
        }
        return item;
      }),
    ng: data.duplicateNGPairs.map(ng => ({
      id: ng.id,
      a: [ng.partA.songId, ng.partA.instrumentId, ng.partA.partIndex] as [string, string, number],
      b: [ng.partB.songId, ng.partB.instrumentId, ng.partB.partIndex] as [string, string, number]
    }))
  };

  // 楽器マスタが標準楽器と異なる（カスタム楽器追加などがある）場合に保存
  if (data.instruments && data.instruments.length > 0) {
    mini.inst = data.instruments.map(inst => ({
      id: inst.id,
      n: inst.name,
      m: inst.movementType
    }));
  }

  return mini;
}

export function expandPayload(mini: MiniPayload): ScheduleState {
  const rooms: Room[] = mini.r.map(r => {
    const room: Room = {
      id: r.id,
      name: r.n,
      capacity: r.c,
      isPersonalPracticeCandidate: !!r.p
    };
    if (r.pi) room.permanentInstrumentId = r.pi;
    return room;
  });

  const songs: Song[] = mini.s.map(s => ({ id: s.id, name: s.n, parts: s.p }));

  const entries: Entry[] = mini.e.map(e => ({
    id: e.id,
    songId: e.sId,
    section: e.s,
    priority: e.pr as 'high' | 'medium' | 'low',
    parts: e.p.map(([instrumentId, partIndex]) => ({ instrumentId, partIndex }))
  }));

  // assignments を復元
  const assignments: Assignment[] = mini.a.map(a => {
    const asm: Assignment = {
      id: `${a.s}_${a.r}`,
      slotIndex: a.s,
      roomId: a.r,
      isPersonalPractice: !!a.pp,
      isLocked: !!a.l,
      parts: a.pt
        ? a.pt.map(p => {
            const pt: { instrumentId: string; partIndex: number; songId?: string } = {
              instrumentId: p.i,
              partIndex: p.pi
            };
            if (p.sId) pt.songId = p.sId;
            return pt;
          })
        : []
    };
    if (a.e) asm.entryId = a.e;
    return asm;
  });

  const duplicateNGPairs: DuplicateNGPair[] = mini.ng.map(ng => ({
    id: ng.id,
    partA: { songId: ng.a[0], instrumentId: ng.a[1], partIndex: ng.a[2] },
    partB: { songId: ng.b[0], instrumentId: ng.b[1], partIndex: ng.b[2] }
  }));

  // カスタム楽器マスタが存在する場合は復元、未指定時は標準楽器に安全にフォールバック（後方互換性）
  const instruments = mini.inst
    ? mini.inst.map(i => ({ id: i.id, name: i.n, movementType: i.m }))
    : STANDARD_INSTRUMENTS;

  return {
    timeSettings: {
      startTime: mini.t.s,
      endTime: mini.t.e,
      slotDuration: mini.t.d,
      intervalDuration: mini.t.i
    },
    rooms,
    instruments,
    songs,
    duplicateNGPairs,
    entries,
    assignments
  };
}

// --- 圧縮エンコード/デコード (Deflate + Base64url) ---
export function encodeScheduleData(data: ScheduleState): string {
  const mini = minifyState(data);
  const json = JSON.stringify(mini);
  const compressed = deflate(new TextEncoder().encode(json));
  return toBase64Url(compressed);
}

export function decodeScheduleData(encoded: string): ScheduleState | null {
  try {
    const compressed = fromBase64Url(encoded);
    const decompressed = inflate(compressed);
    const json = new TextDecoder().decode(decompressed);
    const parsed = JSON.parse(json);
    // 新フォーマット (ミニファイ済み)
    if (parsed.t && parsed.r && parsed.s) {
      return expandPayload(parsed as MiniPayload);
    }
    // 旧フォーマット (フルJSON) - 下位互換
    if (parsed.rooms && parsed.songs) {
      return parsed as ScheduleState;
    }
  } catch {
    // 新形式Deflateで失敗 → 旧Base64形式を試す
    try {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(json);
      if (parsed.rooms && parsed.songs) {
        return parsed as ScheduleState;
      }
    } catch (e2) {
      console.error('Failed to decode schedule data (all formats)', e2);
    }
  }
  return null;
}

// --- 共有URLの生成ヘルパー ---
export function generateShareUrl(data: ScheduleState): string {
  const encoded = encodeScheduleData(data);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${origin}${pathname}#view=member&d=${encoded}`;
}
