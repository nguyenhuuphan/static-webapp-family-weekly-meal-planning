import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function usePersistentState<T>(
  key: string,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        saved === null ||
        typeof saved !== typeof fallback ||
        (fallback !== null &&
          typeof fallback === "object" &&
          Array.isArray(saved) !== Array.isArray(fallback))
      )
        return fallback;
      return saved;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Optional UI preferences. */
    }
  }, [key, value]);
  return [value, setValue];
}
