import { useState, useEffect } from 'react';
import type { ScheduleState } from '../types';
import { decodeScheduleData } from '../utils/shareEncoding';
import { sanitizeScheduleState } from '../utils/scheduleIntegrity';

export interface ParsedScheduleUrlParams {
  shortId: string | null;
  view: string | null;
  data: string | null;
}

/**
 * URLのクエリパラメータおよびハッシュから共有スケジュール関連パラメータを抽出します。
 * 対応パターン:
 * 1. ハッシュ形式: #s=xxx または #view=member&d=xxx
 * 2. ハッシュ直接ID: #abc123 (6文字の半角英数字で '=' を含まない形式)
 * 3. クエリ形式フォールバック: ?s=xxx または ?view=member&d=xxx
 */
export function parseScheduleUrlParams(
  locationSearch: string,
  locationHash: string
): ParsedScheduleUrlParams {
  let shortId: string | null = null;
  let view: string | null = null;
  let data: string | null = null;

  // 1. ハッシュ形式 (#s=xxx or #view=member&d=xxx or #6文字ID)
  const hash = locationHash.replace(/^#/, '');
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    shortId = hashParams.get('s');
    view = hashParams.get('view');
    data = hashParams.get('d');
    if (!shortId && !view && !data && hash.length === 6 && !hash.includes('=')) {
      shortId = hash;
    }
  }

  // 2. クエリ形式フォールバック (?s=xxx or ?view=member&d=xxx)
  if (!shortId && !data) {
    const queryParams = new URLSearchParams(locationSearch);
    shortId = queryParams.get('s');
    view = queryParams.get('view');
    data = queryParams.get('d');
  }

  return { shortId, view, data };
}

export interface UseScheduleUrlLoaderResult {
  isMemberMode: boolean;
  memberData: ScheduleState | null;
  isLoadingSchedule: boolean;
  scheduleLoadError: string | null;
}

export interface UseScheduleUrlLoaderOptions {
  fetchFn?: typeof fetch;
  locationSearch?: string;
  locationHash?: string;
}

/**
 * 短縮IDから /api/schedule を呼び出してスケジュールデータを非同期取得・デコードします。
 */
export async function loadScheduleFromShortId(
  shortId: string,
  fetcher: typeof fetch = window.fetch.bind(window)
): Promise<ScheduleState> {
  const res = await fetcher(`/api/schedule?id=${encodeURIComponent(shortId)}`);
  if (!res.ok) {
    throw new Error('スケジュールが見つかりません。期限切れ（30日経過）の可能性があります。');
  }
  const json = await res.json();
  if (json.data) {
    const decoded = decodeScheduleData(json.data);
    if (decoded) {
      return sanitizeScheduleState(decoded);
    }
  }
  throw new Error('スケジュールデータの復元に失敗しました。');
}

/**
 * URLパラメータ（短縮IDまたはBase64埋め込みデータ）からスケジュールデータを検出し、
 * 非同期ロードおよび部員閲覧モードの状態管理を行うカスタムフック。
 */
export function useScheduleUrlLoader(options?: UseScheduleUrlLoaderOptions): UseScheduleUrlLoaderResult {
  const search = options?.locationSearch ?? (typeof window !== 'undefined' ? window.location.search : '');
  const hash = options?.locationHash ?? (typeof window !== 'undefined' ? window.location.hash : '');
  const fetcher = options?.fetchFn ?? (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : undefined);

  const initialParams = parseScheduleUrlParams(search, hash);

  const initialMemberData = (() => {
    if (initialParams.view === 'member' && initialParams.data) {
      const decoded = decodeScheduleData(initialParams.data);
      if (decoded) return sanitizeScheduleState(decoded);
    }
    return null;
  })();

  const [isMemberMode, setIsMemberMode] = useState(initialMemberData !== null);
  const [memberData, setMemberData] = useState<ScheduleState | null>(initialMemberData);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(initialParams.shortId !== null);
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null);

  useEffect(() => {
    const { shortId, view, data } = parseScheduleUrlParams(search, hash);

    // A. 短縮IDの場合: /api/schedule からデータを非同期取得
    if (shortId) {
      if (!fetcher) return;
      setIsLoadingSchedule(true);
      loadScheduleFromShortId(shortId, fetcher)
        .then(decodedState => {
          setIsMemberMode(true);
          setMemberData(decodedState);
          setIsLoadingSchedule(false);
        })
        .catch(err => {
          console.error('Failed to load schedule', err);
          setScheduleLoadError(err instanceof Error ? err.message : '読み込みに失敗しました。');
          setIsLoadingSchedule(false);
        });
      return;
    }

    // B. フルデータ埋め込みURLの場合: その場で即時デコード
    if (view === 'member' && data) {
      const decoded = decodeScheduleData(data);
      if (decoded) {
        setIsMemberMode(true);
        setMemberData(sanitizeScheduleState(decoded));
      }
    }
  }, [search, hash, fetcher]);

  return {
    isMemberMode,
    memberData,
    isLoadingSchedule,
    scheduleLoadError,
  };
}
