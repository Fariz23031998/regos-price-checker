const SAMPLE_RATES: Record<string, number> = { USD: 1, RUB: 1, UZS: 1 };

function roundTo(round: (value: number) => number, value: number, digits?: number): number {
  if (digits == null) return round(value);
  if (!Number.isInteger(digits) || digits < 0 || digits > 8) return Number.NaN;
  const factor = 10 ** digits;
  const shifted = value * factor;
  const nearest = Math.round(shifted);
  const tolerance = 1e-8 * Math.max(1, Math.abs(nearest));
  const adjusted = Math.abs(shifted - nearest) < tolerance ? nearest : shifted;
  return round(adjusted) / factor;
}

const formulaMath: Math = Object.assign(Object.create(Math), {
  ceil(value: number, digits?: number) {
    return roundTo(Math.ceil, value, digits);
  },
  floor(value: number, digits?: number) {
    return roundTo(Math.floor, value, digits);
  },
  round(value: number, digits?: number) {
    return roundTo(Math.round, value, digits);
  },
});

export function applyPriceFormula(
  formula: string,
  price: number,
  exchangeRate: Record<string, number>,
): number {
  let evaluate: (...args: unknown[]) => unknown;
  try {
    evaluate = new Function(
      "price",
      "exchangeRate",
      "Math",
      "process",
      "require",
      "global",
      "globalThis",
      "Buffer",
      "Function",
      `"use strict"; return (${formula});`,
    ) as (...args: unknown[]) => unknown;
  } catch {
    throw new Error("Формула цены содержит ошибку");
  }

  let result: unknown;
  try {
    result = evaluate(
      price,
      { ...exchangeRate },
      formulaMath,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  } catch {
    throw new Error("Формула цены содержит ошибку");
  }

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Формула цены должна возвращать число");
  }
  return result;
}

export function assertPriceFormula(formula: string, exchangeRate: Record<string, number> = {}): void {
  applyPriceFormula(formula, 1000, { ...SAMPLE_RATES, ...exchangeRate });
}
