import { STORAGE_KEY } from "src/appConfig";
import type { State } from "src/types";
export const storageService = {
  read: (): unknown => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  write: (state: State) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state)),
};
