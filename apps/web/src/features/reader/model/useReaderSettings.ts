import { useStore } from 'zustand';
import { getSettings } from '@/shared/storage/storage';
import { createReaderSettingsStore, type ReaderSettingsState } from './readerSettingsStore';

/** App-wide reader settings; first run picks up settings saved by older versions. */
export const readerSettingsStore = createReaderSettingsStore(localStorage, getSettings);

/** Select only what a component needs, so unrelated setting changes do not re-render it. */
export function useReaderSettings<T>(selector: (s: ReaderSettingsState) => T): T {
  return useStore(readerSettingsStore, selector);
}
