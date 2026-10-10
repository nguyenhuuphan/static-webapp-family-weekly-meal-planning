export const fmt = (n: number) =>
  `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
