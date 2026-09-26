import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ScheduleProvider,
  useSchedule,
  useOptionalSchedule,
  createDefaultScheduleState,
  loadInitialScheduleState,
  STORAGE_KEY,
} from '../ScheduleContext';
import type { ScheduleState } from '../../types';

describe('ScheduleContext and ScheduleProvider', () => {
  let originalLocalStorage: Storage;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    originalLocalStorage = globalThis.localStorage;
    const storageMock: Storage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      key: (index: number) => Object.keys(mockStorage)[index] ?? null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: storageMock,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });

  describe('createDefaultScheduleState', () => {
    it('returns a complete default schedule state with songs, rooms, and instruments', () => {
      const state = createDefaultScheduleState();
      expect(state.timeSettings.startTime).toBe('09:00');
      expect(state.rooms.length).toBeGreaterThan(0);
      expect(state.songs.length).toBeGreaterThan(0);
      expect(state.instruments.length).toBeGreaterThanOrEqual(19);
      expect(state.entries.length).toBeGreaterThan(0);
      expect(state.assignments).toEqual([]);
    });
  });

  describe('loadInitialScheduleState', () => {
    it('returns default state when localStorage is empty', () => {
      const state = loadInitialScheduleState();
      expect(state.songs.length).toBeGreaterThan(0);
    });

    it('loads and sanitizes state from localStorage when valid JSON is present', () => {
      const customState: ScheduleState = {
        ...createDefaultScheduleState(),
        timeSettings: {
          startTime: '08:30',
          endTime: '11:30',
          slotDuration: 30,
          intervalDuration: 10,
        },
      };
      mockStorage[STORAGE_KEY] = JSON.stringify(customState);

      const loaded = loadInitialScheduleState();
      expect(loaded.timeSettings.startTime).toBe('08:30');
      expect(loaded.timeSettings.slotDuration).toBe(30);
    });

    it('falls back to default state when localStorage contains invalid or corrupted JSON', () => {
      mockStorage[STORAGE_KEY] = 'INVALID_JSON{{{';
      const loaded = loadInitialScheduleState();
      expect(loaded.timeSettings.startTime).toBe('09:00');
    });

    it('falls back to default state when saved state lacks required instruments or fields', () => {
      mockStorage[STORAGE_KEY] = JSON.stringify({
        rooms: [],
        songs: [],
        instruments: [], // less than 19 instruments
      });
      const loaded = loadInitialScheduleState();
      expect(loaded.instruments.length).toBeGreaterThanOrEqual(19);
    });
  });

  describe('useSchedule & useOptionalSchedule', () => {
    it('throws an error when useSchedule is called outside ScheduleProvider', () => {
      function Consumer() {
        useSchedule();
        return React.createElement('div', null, 'test');
      }

      expect(() => {
        renderToString(React.createElement(Consumer));
      }).toThrow('useSchedule must be used within a ScheduleProvider');
    });

    it('returns null when useOptionalSchedule is called outside ScheduleProvider', () => {
      let result: ReturnType<typeof useOptionalSchedule> = undefined as any;
      function Consumer() {
        result = useOptionalSchedule();
        return React.createElement('div', null, 'test');
      }

      renderToString(React.createElement(Consumer));
      expect(result).toBeNull();
    });

    it('provides state, setState, undoControls, and resetState when inside ScheduleProvider', () => {
      let capturedContext: ReturnType<typeof useSchedule> | null = null;

      function Consumer() {
        capturedContext = useSchedule();
        return React.createElement('div', null, capturedContext.state.timeSettings.startTime);
      }

      renderToString(
        React.createElement(
          ScheduleProvider,
          { persistToLocalStorage: false },
          React.createElement(Consumer)
        )
      );

      expect(capturedContext).not.toBeNull();
      expect(capturedContext!.state).toBeDefined();
      expect(capturedContext!.state.timeSettings.startTime).toBe('09:00');
      expect(typeof capturedContext!.setState).toBe('function');
      expect(typeof capturedContext!.resetState).toBe('function');
      expect(capturedContext!.undoControls).toBeDefined();
      expect(typeof capturedContext!.undoControls.undo).toBe('function');
      expect(capturedContext!.undoControls.canUndo).toBe(false);
    });

    it('supports custom initialState in ScheduleProvider', () => {
      const customInitial: ScheduleState = {
        ...createDefaultScheduleState(),
        timeSettings: {
          startTime: '07:00',
          endTime: '10:00',
          slotDuration: 60,
          intervalDuration: 0,
        },
      };

      let capturedState: ScheduleState | null = null;
      function Consumer() {
        const { state } = useSchedule();
        capturedState = state;
        return React.createElement('div', null, state.timeSettings.startTime);
      }

      renderToString(
        React.createElement(
          ScheduleProvider,
          { initialState: customInitial, persistToLocalStorage: false },
          React.createElement(Consumer)
        )
      );

      expect(capturedState).not.toBeNull();
      expect(capturedState!.timeSettings.startTime).toBe('07:00');
    });
  });
});
