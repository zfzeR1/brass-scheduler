# Project: Brass Scheduler Feature Development and Verification

## Architecture
- **Framework & Build**: React 19, TypeScript (~6.0.2), Vite 8.
- **Data Models**: Domain models in `src/types.ts` (`ScheduleState`, `TimeSettings`, `Room`, `Instrument`, `Song`, `Entry`, `Assignment`, `DuplicateNGPair`, `SelectedPart`).
- **Core Scheduler & Solver**: `src/utils/scheduler.ts` (penalty evaluations, greedy/backtracking placement, slot calculations).
- **Persistence & Serialization**:
  - Admin state: `localStorage['antigravity_schedule_state_v3']`.
  - Member part memory (R1): `localStorage['brass_scheduler_selected_parts_v1']` with sanitization via `src/utils/partStorage.ts`.
  - Share URL compression: pako Deflate + Base64Url (`encodeScheduleData` / `decodeScheduleData`) and Upstash Redis 6-char short IDs (`/api/schedule`).
- **UI & State Flow**:
  - Root: `src/App.tsx` manages central `ScheduleState` and URL hash/query routing (Admin mode vs Member mode).
  - Step 1: `src/components/MasterDataTab.tsx` (Time, Rooms, Songs, NG Pairs, Section entries).
  - Step 2: `src/components/ScheduleTab.tsx` (Timetable generation, drag-drop/tap swap, editing modal, slot lock, Undo stack [R3]).
  - Step 3: `src/App.tsx` Share view (LINE copy, QR modal, PNG export [R2], Admin preview).
  - Member View: `src/components/MyPageTab.tsx` (Auto-restored part memory [R1], personal timetable, room movement indicators).
  - PNG Export (R2): `src/components/TimetableExportView.tsx` off-screen unclipped high-DPI rendering via `html-to-image`.
  - Test Suite (R4): Vitest runner, `src/utils/__tests__/`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R4: Test Runner Environment | Install vitest, add `test` script in package.json, configure vite.config.ts | M1 | ORIGINAL_REQUEST §R4 |
| 2 | R4: Scheduler & Core Unit Tests | Unit tests for slot math, penalty scoring, schedule generation, share encoding | M1 | ORIGINAL_REQUEST §R4 |
| 3 | R1: Part Selection Storage Utility | `sanitizeSelectedParts`, `loadSavedSelectedParts`, `saveSelectedParts` in `src/utils/partStorage.ts` with unit tests | M2 | ORIGINAL_REQUEST §R1 |
| 4 | R1: MyPageTab LocalStorage Integration | Auto-restore on mount, auto-collapse panel, reactive sanitization on song changes | M2 | ORIGINAL_REQUEST §R1 |
| 5 | R3: Undo History Utility / Hook | `useScheduleUndo` with deep copy `structuredClone`, 25-step cap, unit tests | M3 | ORIGINAL_REQUEST §R3 |
| 6 | R3: ScheduleTab Undo UI & Integration | Wrap all 6 assignment mutations, "↩︎ 元に戻す (Undo)" button with count badge | M3 | ORIGINAL_REQUEST §R3 |
| 7 | R2: Timetable Export View Component | `TimetableExportView.tsx` unclipped clean grid with high-contrast styling | M4 | ORIGINAL_REQUEST §R2 |
| 8 | R2: PNG Export Action & Modal | `html-to-image` export trigger in Step 3 and Step 2, mobile-friendly save modal | M4 | ORIGINAL_REQUEST §R2 |
| 9 | R5: Full Test Suite Execution | Verify `npm test` runs and all tests pass with 0 failures | M5 | ORIGINAL_REQUEST §R5 |
| 10 | R5: Typecheck & Build Verification | Verify `npm run build` succeeds without TypeScript or Vite errors | M5 | ORIGINAL_REQUEST §R5 |
| 11 | R5: Non-Regression & End-to-End Verification | Verify Step 1 CRUD, Step 2 drag/swap/lock, Step 3 URL/LINE/QR, Member View | M5 | ORIGINAL_REQUEST §R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | R4: Test Infra & Core Test Suite | vitest, package.json test script, vite.config.ts, scheduler.test.ts, shareEncoding.test.ts | none | DONE |
| M2 | R1: Part Selection LocalStorage & Auto-Restore | types.ts, partStorage.ts, partStorage.test.ts, MyPageTab.tsx integration | M1 | DONE |
| M3 | R3: Undo History Stack in Step 2 | useScheduleUndo.ts, history.test.ts, ScheduleTab.tsx integration & UI button | M1 | DONE |
| M4 | R2: Timetable PNG Export | html-to-image, TimetableExportView.tsx, Step 3 & Step 2 export integration | none | DONE |
| M5 | R5: Full Test Pass, Build & Non-Regression | `npm test`, `npm run build`, forensic audit, reviewer and challenger verification | M1, M2, M3, M4 | IN_PROGRESS |

## Interface Contracts

### M2 (R1: partStorage.ts)
```typescript
export interface SelectedPart {
  songId: string;
  instrumentId: string;
  partIndex: number;
}
export function sanitizeSelectedParts(raw: unknown, songs: Song[]): SelectedPart[];
export function loadSavedSelectedParts(songs: Song[]): SelectedPart[];
export function saveSelectedParts(parts: SelectedPart[]): void;
```

### M3 (R3: useScheduleUndo.ts)
```typescript
export function useScheduleUndo(initialAssignments: Assignment[]): {
  assignments: Assignment[];
  setAssignmentsWithHistory: (updater: Assignment[] | ((prev: Assignment[]) => Assignment[])) => void;
  undo: () => void;
  canUndo: boolean;
  historyLength: number;
  resetHistory: (newAssignments?: Assignment[]) => void;
};
```

### M4 (R2: TimetableExportView.tsx)
```typescript
export interface TimetableExportViewProps {
  state: ScheduleState;
}
export function exportTimetableToPng(element: HTMLElement, filename?: string): Promise<string>;
```

## Code Layout
- `src/types.ts`: Domain models (including exported `SelectedPart`)
- `src/utils/scheduler.ts`: Core algorithm (existing, intact)
- `src/utils/partStorage.ts`: Part localStorage persistence and sanitization
- `src/utils/shareEncoding.ts`: Minify/expand/encode/decode utilities (refactored from App.tsx or tested directly)
- `src/hooks/useScheduleUndo.ts`: Undo stack hook
- `src/components/TimetableExportView.tsx`: Clean off-screen export component
- `src/components/MyPageTab.tsx`: Updated with part auto-restore
- `src/components/ScheduleTab.tsx`: Updated with undo button and mutations wrapped
- `src/App.tsx`: Updated with Step 3 PNG export button
- `src/utils/__tests__/`: All Vitest unit tests
