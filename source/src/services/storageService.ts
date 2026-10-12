import { STORAGE_KEY } from "src/appConfig";
import type { State } from "src/types";
export const storageService = {
  raw: () => localStorage.getItem(STORAGE_KEY),
  lastGood: () => localStorage.getItem(STORAGE_KEY + ":last-good"),
  preserveFailed: (raw: string) =>
    localStorage.setItem(STORAGE_KEY + ":recovery:" + Date.now(), raw),
  read: (): unknown => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  write: (state: State) => {
    const raw = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY + ":last-good", raw);
    localStorage.setItem(STORAGE_KEY, raw);
  },
};
