import type { GlobalPartRef, LocalPartRef } from '../types';

/**
 * 2つの大域パート参照（GlobalPartRef）が同一のパートを指しているかを厳密に判定します。
 */
export function isSameGlobalPart(
  a: GlobalPartRef | null | undefined,
  b: GlobalPartRef | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.songId === b.songId && a.instrumentId === b.instrumentId && a.partIndex === b.partIndex;
}

/**
 * 2つの局所パート参照（LocalPartRef）が同一のパートを指しているかを判定します。
 */
export function isSameLocalPart(
  a: LocalPartRef | null | undefined,
  b: LocalPartRef | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.instrumentId === b.instrumentId && a.partIndex === b.partIndex;
}

/**
 * 大域パート参照からMapやSetのキーとして利用可能な一意の文字列を生成します。
 */
export function getGlobalPartKey(part: GlobalPartRef): string {
  return `${part.songId}:${part.instrumentId}:${part.partIndex}`;
}

/**
 * 局所パート参照から一意の文字列キーを生成します。
 */
export function getLocalPartKey(part: LocalPartRef): string {
  return `${part.instrumentId}:${part.partIndex}`;
}

/**
 * 局所パート参照と楽曲IDから大域パート参照を生成します。
 */
export function toGlobalPart(songId: string, localPart: LocalPartRef): GlobalPartRef {
  return {
    songId,
    instrumentId: localPart.instrumentId,
    partIndex: localPart.partIndex,
  };
}

/**
 * 大域パート参照から局所パート参照（楽曲IDを除去）を抽出します。
 */
export function toLocalPart(globalPart: GlobalPartRef): LocalPartRef {
  return {
    instrumentId: globalPart.instrumentId,
    partIndex: globalPart.partIndex,
  };
}
