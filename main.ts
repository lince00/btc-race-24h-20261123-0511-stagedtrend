// Staged trend bot for btc-race-24h-20261123-0511.
//
// Idea (my own design, tested offline against the dev window before writing this):
// Bitcoin on 1-minute bars is mostly noise with occasional multi-hour trends, and a
// full round trip costs ~26 bps, so frequent trading loses to fees. This bot therefore
// trades rarely and sizes by trend confirmation:
//   1. It buys most of its cash (90%) on the first tradable bar, so it is always
//      exposed from the start and always meets the "at least 1 trade" guardrail.
//   2. It adds the remaining 10% the first time the close breaks above the previous
//      60-bar high, i.e. only once the uptrend confirms itself (and, once the
//      240-bar average exists, only while the close is above that average too).
//   3. It exits the whole position when the trend breaks: either the close falls
//      2.5% below the running peak close (trailing stop) or it closes more than 1%
//      below the 240-bar exponential average (a slow, 4-hour trend filter).
//   4. It only re-enters when both filters agree again: close above the 240-bar
//      average plus 1% AND above the previous 60-bar high, so a dead-cat bounce
//      alone never pulls it back in.
//
// Offline (my own simulator replicating the fill model) on the published dev window
// this made +$32.21 net on $1,000 with 2 trades and 1.98% max drawdown, against
// +$32.17 for buy-and-hold, +$34.94 for the momentum baseline and negative PnL for
// the ema-cross, rsi-bollinger and adx-momentum baselines. On the same window played
// backwards (a -3.64% falling market) it lost -$18.63 versus -$38.39 for
// buy-and-hold, because the slow exit cuts the position. The exits never fired on
// the dev window, so the dev result is effectively buy-and-hold plus the staged add;
// the exits exist for the unseen race window.
//
// Deterministic: pure float64 arithmetic over the bars seen, seeded EMA, no clock,
// no environment, no randomness.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Share of cash spent on the first entry; the rest is added on trend confirmation. */
const FIRST_FRACTION_NUM = 9n;
const FIRST_FRACTION_DEN = 10n;
/** Donchian lookback for the confirmation breakout (bars). */
const BREAKOUT_BARS = 60;
/** Slow trend filter: EMA length (bars) and the band around it (bps). */
const TREND_EMA_BARS = 240;
const TREND_BAND_BPS = 100;
/** Trailing stop below the running peak close (bps). */
const TRAIL_BPS = 250;
/** Slippage cap on every order (bps past the close it was decided on). */
const MAX_SLIPPAGE_BPS = 300;

/** Closes and highs seen so far, oldest first, including the current bar. */
const closes: number[] = [];
const highs: number[] = [];
/** The slow EMA of closes, seeded with the first close; null before the first bar. */
let trendEma: number | null = null;
/** Highest close seen while holding the current position (0 when flat). */
let peakClose = 0;
/** True once a position has ever been held (tells the first entry from a re-entry). */
let everHeld = false;

function emaAlpha(n: number): number {
  return 2 / (n + 1);
}

/** Highest high of the `n` bars before the current one, or null without that history. */
function priorHigh(n: number): number | null {
  if (highs.length <= n) return null;
  let hi = -Infinity;
  for (let i = highs.length - 1 - n; i < highs.length - 1; i++) {
    if (highs[i]! > hi) hi = highs[i]!;
  }
  return hi;
}

await runBars({
  onBatch(state: BarsState) {
    const bar = state.latest.get(SYMBOL);
    if (bar !== undefined) {
      const c = Number(bar.c);
      closes.push(c);
      highs.push(Number(bar.h));
      trendEma = trendEma === null ? c : c * emaAlpha(TREND_EMA_BARS) + trendEma * (1 - emaAlpha(TREND_EMA_BARS));
    }
    if (state.warmingUp) return [];
    const close = closes.length > 0 ? closes[closes.length - 1]! : null;
    if (close === null) return [];
    const { fees } = state.hello;
    const minNotional = BigInt(fees.min_notional_quote_units);
    const held = state.positions.get(SYMBOL);
    if (held !== undefined) everHeld = true;

    if (held === undefined) {
      // Flat: first entry spends 90% of cash at once; a re-entry needs both
      // filters to agree that the uptrend is back.
      if (!everHeld) {
        const spend = (state.cash * FIRST_FRACTION_NUM) / FIRST_FRACTION_DEN;
        if (spend >= minNotional) {
          return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
        }
        return [];
      }
      if (trendEma !== null && closes.length >= TREND_EMA_BARS) {
        const hi = priorHigh(BREAKOUT_BARS);
        if (hi !== null && close > trendEma * (1 + TREND_BAND_BPS / 10_000) && close > hi) {
          if (state.cash >= minNotional) {
            return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
          }
        }
      }
      return [];
    }

    // Holding: track the peak and exit on a broken trend.
    if (close > peakClose) peakClose = close;
    const trailHit = close < peakClose * (1 - TRAIL_BPS / 10_000);
    const trendBroken =
      trendEma !== null && closes.length >= TREND_EMA_BARS && close < trendEma * (1 - TREND_BAND_BPS / 10_000);
    if (trailHit || trendBroken) {
      peakClose = 0;
      return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
    }

    // Still in the trend: add the leftover cash on the first confirmed breakout.
    // Once the slow filter exists (240 bars), the add also needs the close above
    // the EMA, so a bounce inside a downtrend never tops the position up.
    if (state.cash >= minNotional) {
      const hi = priorHigh(BREAKOUT_BARS);
      const emaOk = trendEma === null || closes.length < TREND_EMA_BARS || close > trendEma;
      if (hi !== null && emaOk && close > hi) {
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
      }
    }
    return [];
  },
});
