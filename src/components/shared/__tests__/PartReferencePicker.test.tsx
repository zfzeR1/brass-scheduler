import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PartReferencePicker from '../PartReferencePicker';
import type { Song, Instrument, PartReference } from '../../../types';

describe('PartReferencePicker Component', () => {
  const mockSongs: Song[] = [
    {
      id: 'song-1',
      name: '宝島',
      parts: { fl: 2, trp: 3 }
    },
    {
      id: 'song-2',
      name: 'ディスコ・キッド',
      parts: { fl: 1, cl: 2 }
    }
  ];

  const mockInstruments: Instrument[] = [
    { id: 'fl', name: 'フルート', movementType: 'movable' },
    { id: 'cl', name: 'クラリネット', movementType: 'movable' },
    { id: 'trp', name: 'トランペット', movementType: 'movable' }
  ];

  it('renders unselected initial state with placeholder prompt', () => {
    const value: PartReference = { songId: '', instrumentId: '', partIndex: 0 };
    const handleChange = vi.fn();

    const html = renderToString(
      React.createElement(PartReferencePicker, {
        songs: mockSongs,
        instruments: mockInstruments,
        value,
        onChange: handleChange,
        required: true
      })
    );

    expect(html).toContain('曲を選択');
    expect(html).toContain('曲を先に選択');
    expect(html).toContain('楽器を先に選択');
    expect(html).toContain('宝島');
    expect(html).toContain('ディスコ・キッド');
  });

  it('renders available instruments filtered for the selected song', () => {
    const value: PartReference = { songId: 'song-1', instrumentId: 'trp', partIndex: 1 };
    const handleChange = vi.fn();

    const html = renderToString(
      React.createElement(PartReferencePicker, {
        songs: mockSongs,
        instruments: mockInstruments,
        value,
        onChange: handleChange
      })
    );

    expect(html).toContain('フルート');
    expect(html).toContain('トランペット');
    // クラリネットは song-1 の parts にないので option に含まれない
    expect(html).not.toContain('<option value="cl">クラリネット</option>');
    // トランペットは 3 パートあるので 1st, 2nd, 3rd がレンダリングされる
    expect(html).toContain('トランペット 1');
    expect(html).toContain('トランペット 2');
    expect(html).toContain('トランペット 3');
  });

  it('renders custom/extra instruments not in instruments master', () => {
    const songWithCustom: Song = {
      id: 'song-3',
      name: 'オリジナル曲',
      parts: { 'ピッコロ': 1 }
    };
    const value: PartReference = { songId: 'song-3', instrumentId: 'ピッコロ', partIndex: 0 };

    const html = renderToString(
      React.createElement(PartReferencePicker, {
        songs: [songWithCustom],
        instruments: mockInstruments,
        value,
        onChange: vi.fn()
      })
    );

    expect(html).toContain('ピッコロ');
  });
});
