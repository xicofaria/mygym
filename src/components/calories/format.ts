export const fmt = (n: number) =>
  new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(n);
