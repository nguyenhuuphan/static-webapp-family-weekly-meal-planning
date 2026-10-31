import { createContext, useContext, useState, type ReactNode } from "react";
const Context = createContext<{
  accessCode: string;
  setAccessCode: (code: string) => void;
} | null>(null);
export const FAMILY_CODE_KEY = "family-access-code-v1";
export function readFamilyCode() {
  try {
    return localStorage.getItem(FAMILY_CODE_KEY) || "";
  } catch {
    return "";
  }
}
export function FamilyAccessProvider({ children }: { children: ReactNode }) {
  const [accessCode, setCode] = useState(readFamilyCode);
  const setAccessCode = (code: string) => {
    setCode(code);
    try {
      if (code) localStorage.setItem(FAMILY_CODE_KEY, code);
      else localStorage.removeItem(FAMILY_CODE_KEY);
    } catch {
      /* Browser storage may be unavailable; the session still works. */
    }
  };
  return (
    <Context.Provider value={{ accessCode, setAccessCode }}>
      {children}
    </Context.Provider>
  );
}
export function useFamilyAccess() {
  const value = useContext(Context);
  if (!value) throw Error("FamilyAccessProvider is required");
  return value;
}
