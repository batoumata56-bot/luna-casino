import { useCasino, useStakeGuard } from '../store/CasinoContext'

export function StakeControls({
  stake,
  setStake,
  disabled,
}: {
  stake: number
  setStake: (n: number) => void
  disabled?: boolean
}) {
  const { user } = useCasino()
  const cash = user.wallet.cash
  return (
    <div className="stake-bar">
      <label>
        Mise
        <input
          type="number"
          min={1}
          max={cash}
          value={stake}
          disabled={disabled}
          onChange={(e) => setStake(Number(e.target.value))}
        />
      </label>
      <div className="stake-presets">
        {[50, 100, 250, 500, 1000].map((v) => (
          <button
            key={v}
            type="button"
            className="chip"
            disabled={disabled || v > cash}
            onClick={() => setStake(v)}
          >
            {v}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          disabled={disabled || cash < 1}
          onClick={() => setStake(cash)}
        >
          Max
        </button>
      </div>
    </div>
  )
}

export function useGameSettle(gameId?: import('../types').GameId) {
  const { settleBet, user } = useCasino()
  return {
    cash: user.wallet.cash,
    trySettle: (stake: number, payout: number) => {
      if (stake <= 0) return false
      if (user.wallet.cash < stake) return false
      return settleBet(stake, payout, gameId)
    },
  }
}

export { useStakeGuard }
