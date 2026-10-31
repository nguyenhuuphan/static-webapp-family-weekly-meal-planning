import { createContext, useContext, useState, type ReactNode } from "react";
const Context = createContext<{
  accessCode: string;
  setAccessCode: (code: string) => void;
} | null>(null);
export function FamilyAccessProvider({ children }: { children: ReactNode }) {
  const [accessCode, setAccessCode] = useState("");
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
