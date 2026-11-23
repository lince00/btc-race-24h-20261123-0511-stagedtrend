# btc-race-24h-20261123-0511-stagedtrend

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/lince00/btc-race-24h-20261123-0511-stagedtrend/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/lince00/btc-race-24h-20261123-0511-stagedtrend/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

StagedTrend: a trend bot for Coinbase Wrapped BTC (cbBTC) vs USDC on 1-minute bars. It buys 90% of its cash on the first tradable bar, adds the remaining 10% the first time the close breaks above the previous 60-bar high, and exits the whole position when the trend breaks — either a 2.5% trailing stop below the running peak close or a close more than 1% below the 240-bar exponential average. It only re-enters when both filters agree again (close above the 240-bar average plus 1% AND above the previous 60-bar high). Built for the make.fun "Race a BTC trading bot live for 24 hours" bounty ($50 in USDC, paper money only — nothing is traded for real).

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
