import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App';

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    window.location.search = '';
  });

  it('renders top navigation header and default STEP 1 tab', () => {
    render(<App />);

    expect(screen.getByText('Brass Scheduler')).toBeDefined();
    expect(screen.getByRole('button', { name: /STEP 1: 基本条件設定/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /STEP 2: スケジュール生成/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /STEP 3: 共有・確認/ })).toBeDefined();

    // デフォルト表示は STEP 1（基本条件設定）
    expect(screen.getByText('練習時間・コマ設定')).toBeDefined();
  });

  it('navigates to STEP 2 and STEP 3 when conditions are valid', () => {
    render(<App />);

    // STEP 2 タブをクリック
    const step2Btn = screen.getByText('スケジュール生成');
    fireEvent.click(step2Btn);

    // STEP 2 の画面（スケジュール自動生成・微調整）が表示されるか
    expect(screen.getByText('スケジュール自動生成・微調整')).toBeDefined();

    // STEP 3 タブをクリック
    const step3Btn = screen.getByText('共有・確認');
    fireEvent.click(step3Btn);

    // STEP 3 の画面（共有・個人時間割確認）が表示されるか
    expect(screen.getByText('共有・個人時間割確認')).toBeDefined();
  });
});
