import { useEffect, useMemo, useState } from 'react'
import { canSplit, drawCard, handValue, isBlackjack, type Card } from '../lib/games'
import { useGameSettle, useStakeGuard } from '../components/StakeControls'
import { useCasino, usePlayTimer } from '../store/CasinoContext'
import { useRoomReport } from '../store/RoomContext'
import { formatMoney } from '../lib/format'

const MAX_SPOTS = 3
const MAX_HANDS_PER_SPOT = 4
const PRESETS = [100, 250, 500, 1000, 2500, 10_000]

type BjHand = {
  id: number
  spot: number
  cards: Card[]
  bet: number
  done: boolean
  doubled: boolean
  fromSplit: boolean
  settled: boolean
}

function PlayingCard({
  card,
  hidden,
  dealDelay,
  back,
}: {
  card?: Card
  hidden?: boolean
  dealDelay?: number
  back: string
}) {
  const [flipped, setFlipped] = useState(!hidden)

  useEffect(() => {
    if (hidden) {
      setFlipped(false)
      return
    }
    const t = window.setTimeout(() => setFlipped(true), dealDelay ?? 80)
    return () => window.clearTimeout(t)
  }, [hidden, card?.id, dealDelay])

  const red = card && (card.suit === '♥' || card.suit === '♦')
  return (
    <div
      className={`bj-card ${flipped ? 'flipped' : ''} ${red ? 'red' : ''}`}
      style={{ animationDelay: `${dealDelay ?? 0}ms` }}
    >
      <div className="bj-card-inner">
        <div className={`bj-card-back ${back}`} />
        <div className="bj-card-face">
          {card && (
            <>
              <span className="corner tl">
                {card.label}
                <br />
                {card.suit}
              </span>
              <span className="center">{card.suit}</span>
              <span className="corner br">
                {card.label}
                <br />
                {card.suit}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function BlackjackGame() {
  const { stake, setStake, cash } = useStakeGuard()
  const { trySettle } = useGameSettle('blackjack')
  const { user } = useCasino()
  const report = useRoomReport()
  const back = user.profile.cardback || 'card-classic'

  const [phase, setPhase] = useState<'idle' | 'player' | 'dealer' | 'done'>('idle')
  const [spots, setSpots] = useState<number[]>([stake, 0, 0])
  const [dealer, setDealer] = useState<Card[]>([])
  const [hands, setHands] = useState<BjHand[]>([])
  const [active, setActive] = useState(0)
  const [message, setMessage] = useState('1, 2 ou 3 mains — même croupier, mises libres.')
  const [hideHole, setHideHole] = useState(true)
  const [seq, setSeq] = useState(1)
  usePlayTimer(true, 'blackjack')

  const current = hands[active]
  const totalBet = useMemo(() => spots.reduce((s, n) => s + Math.max(0, n), 0), [spots])
  const liveBet = useMemo(() => hands.reduce((s, h) => s + h.bet, 0), [hands])

  const setSpot = (i: number, n: number) => {
    setSpots((prev) => prev.map((v, k) => (k === i ? Math.max(0, Math.floor(n)) : v)))
  }

  const advanceOrDealer = (updated: BjHand[]) => {
    const nextIdx = updated.findIndex((h, i) => i > active && !h.done)
    if (nextIdx >= 0) {
      setActive(nextIdx)
      setMessage(`Main ${nextIdx + 1}`)
      return
    }
    if (updated.every((h) => h.done)) playDealer(updated)
  }

  const deal = () => {
    if (phase === 'player' || phase === 'dealer') return
    const live = spots.map((n) => Math.max(0, Math.floor(n)))
    const sum = live.reduce((s, n) => s + n, 0)
    if (sum <= 0) {
      setMessage('Mets au moins une mise sur une main')
      return
    }
    if (cash < sum) {
      setMessage('Fonds insuffisants pour ces 3 mises')
      return
    }
    report('bet', { amount: sum, detail: `${live.filter((n) => n > 0).length} main(s) de blackjack` })
    const d = [drawCard(), drawCard()]
    setDealer(d)
    setHideHole(true)
    let id = seq
    const dealt: BjHand[] = []
    live.forEach((bet, spot) => {
      if (bet <= 0) return
      dealt.push({
        id: id++,
        spot,
        cards: [drawCard(), drawCard()],
        bet,
        done: false,
        doubled: false,
        fromSplit: false,
        settled: false,
      })
    })
    setSeq(id)
    setHands(dealt)

    const dealerBj = isBlackjack(d)
    const allPlayerBj = dealt.every((h) => isBlackjack(h.cards))
    if (dealerBj || allPlayerBj) {
      setHideHole(false)
      window.setTimeout(() => settleVsDealer(dealt, d, true), 400)
      return
    }
    const auto: BjHand[] = dealt.map((h) => {
      if (!isBlackjack(h.cards)) return h
      const pay = Math.floor(h.bet * 2.5)
      trySettle(h.bet, pay)
      return { ...h, done: true, settled: true }
    })
    setHands(auto)
    const first = auto.findIndex((h) => !h.done)
    if (first < 0) {
      playDealer(auto)
      return
    }
    setActive(first)
    setPhase('player')
    setMessage('À toi de jouer')
  }

  const hit = () => {
    if (phase !== 'player' || !current || current.done) return
    const cards = [...current.cards, drawCard()]
    if (handValue(cards) > 21) {
      trySettle(current.bet, 0)
      const updated = hands.map((h, i) =>
        i === active ? { ...h, cards, done: true, settled: true } : h,
      )
      setHands(updated)
      setMessage(`Bust (${handValue(cards)})`)
      advanceOrDealer(updated)
      return
    }
    setHands((hs) => hs.map((h, i) => (i === active ? { ...h, cards } : h)))
  }

  const stand = () => {
    if (phase !== 'player' || !current) return
    const updated = hands.map((h, i) => (i === active ? { ...h, done: true } : h))
    setHands(updated)
    advanceOrDealer(updated)
  }

  const doubleDown = () => {
    if (phase !== 'player' || !current || current.cards.length !== 2 || current.doubled) return
    const newBet = current.bet * 2
    const others = hands.reduce((s, h, i) => (i === active ? s : s + h.bet), 0)
    if (cash < others + newBet) {
      setMessage('Pas assez pour doubler')
      return
    }
    const cards = [...current.cards, drawCard()]
    if (handValue(cards) > 21) {
      trySettle(newBet, 0)
      const updated = hands.map((h, i) =>
        i === active ? { ...h, cards, bet: newBet, done: true, doubled: true, settled: true } : h,
      )
      setHands(updated)
      setMessage('Double → bust')
      advanceOrDealer(updated)
      return
    }
    const updated = hands.map((h, i) =>
      i === active ? { ...h, cards, bet: newBet, done: true, doubled: true } : h,
    )
    setHands(updated)
    advanceOrDealer(updated)
  }

  const split = () => {
    if (phase !== 'player' || !current || !canSplit(current.cards)) return
    const inSpot = hands.filter((h) => h.spot === current.spot).length
    if (inSpot >= MAX_HANDS_PER_SPOT) {
      setMessage('Maximum 4 mains par emplacement')
      return
    }
    if (cash < current.bet * 2 + hands.reduce((s, h, i) => (i === active ? s : s + h.bet), 0)) {
      setMessage('Pas assez pour splitter')
      return
    }
    const [c1, c2] = current.cards
    const aceSplit = c1!.rank === 1
    const left: BjHand = {
      id: seq,
      spot: current.spot,
      cards: [c1!, drawCard()],
      bet: current.bet,
      done: aceSplit,
      doubled: false,
      fromSplit: true,
      settled: false,
    }
    const right: BjHand = {
      id: seq + 1,
      spot: current.spot,
      cards: [c2!, drawCard()],
      bet: current.bet,
      done: aceSplit,
      doubled: false,
      fromSplit: true,
      settled: false,
    }
    setSeq((n) => n + 2)
    const updated = [...hands.slice(0, active), left, right, ...hands.slice(active + 1)]
    setHands(updated)
    if (aceSplit && updated.every((h) => h.done)) {
      playDealer(updated)
      return
    }
    setMessage('Split — continue tant que tu as une paire')
  }

  const settleVsDealer = (playerHands: BjHand[], d: Card[], fromDeal = false) => {
    const dVal = handValue(d)
    const dBj = isBlackjack(d)
    const parts: string[] = []

    for (let i = 0; i < playerHands.length; i++) {
      const h = playerHands[i]!
      if (h.settled) {
        parts.push(`M${i + 1} réglé`)
        continue
      }
      const pVal = handValue(h.cards)
      const pBj = isBlackjack(h.cards) && !h.fromSplit
      const bet = h.bet

      if (pVal > 21) {
        trySettle(bet, 0)
        parts.push(`M${i + 1} bust`)
        continue
      }
      if (pBj && dBj) {
        trySettle(bet, bet)
        parts.push(`M${i + 1} push BJ`)
      } else if (pBj) {
        const pay = Math.floor(bet * 2.5)
        trySettle(bet, pay)
        parts.push(`M${i + 1} BJ`)
      } else if (dBj || (dVal <= 21 && dVal > pVal)) {
        trySettle(bet, 0)
        parts.push(`M${i + 1} perdu`)
      } else if (dVal > 21 || pVal > dVal) {
        trySettle(bet, bet * 2)
        parts.push(`M${i + 1} +${bet}`)
      } else {
        trySettle(bet, bet)
        parts.push(`M${i + 1} push`)
      }
    }
    setMessage(parts.join(' · '))
    report('action', { detail: `blackjack — ${parts.join(' · ')}` })
    setPhase('done')
    if (fromDeal) setHands(playerHands.map((h) => ({ ...h, done: true })))
  }

  const playDealer = (playerHands: BjHand[]) => {
    setPhase('dealer')
    setHideHole(false)
    setMessage('Tour du croupier…')
    window.setTimeout(() => {
      setDealer((cur) => {
        let d = [...cur]
        while (handValue(d) < 17) d = [...d, drawCard()]
        window.setTimeout(() => settleVsDealer(playerHands, d), 0)
        return d
      })
    }, 700)
  }

  const busy = phase === 'player' || phase === 'dealer'
  const spotHands = (i: number) => hands.filter((h) => h.spot === i)

  return (
    <div className="game-panel bj-table bj-arena">
      <div className="bj-toolbar">
        <p className="game-msg">{message}</p>
        <div className="btn-row">
          {!busy && (
            <button type="button" className="btn primary" onClick={deal}>
              Jouer{totalBet > 0 ? ` · ${formatMoney(totalBet)} LC` : ''}
            </button>
          )}
          {phase === 'player' && (
            <>
              <button type="button" className="btn primary" onClick={hit}>
                Tirer
              </button>
              <button type="button" className="btn" onClick={stand}>
                Rester
              </button>
              <button
                type="button"
                className="btn"
                disabled={!current || current.cards.length !== 2}
                onClick={doubleDown}
              >
                Doubler
              </button>
              <button
                type="button"
                className="btn"
                disabled={
                  !current ||
                  !canSplit(current.cards) ||
                  hands.filter((h) => h.spot === current.spot).length >= MAX_HANDS_PER_SPOT
                }
                onClick={split}
              >
                Splitter
              </button>
            </>
          )}
        </div>
        {phase === 'idle' && (
          <p className="hint">
            Engagé {formatMoney(totalBet)} LC · Cash {formatMoney(cash)} LC · 1 à 3 mains
          </p>
        )}
        {busy && (
          <p className="hint">
            En jeu {formatMoney(liveBet)} LC · Split possible tant que tu as une paire (max 4 / case)
          </p>
        )}
      </div>

      <div className="bj-dealer">
        <div className="bj-label">
          Croupier
          {phase !== 'idle' && (hideHole ? ' · ?' : ` · ${handValue(dealer)}`)}
        </div>
        <div className="bj-cards">
          {dealer.map((c, i) => (
            <PlayingCard
              key={c.id}
              card={c}
              hidden={hideHole && i === 1}
              dealDelay={i * 140}
              back={back}
            />
          ))}
        </div>
      </div>

      <div className="bj-spots">
        {Array.from({ length: MAX_SPOTS }, (_, i) => {
          const list = spotHands(i)
          const isLive = list.some((h) => hands[active]?.id === h.id && phase === 'player')
          return (
            <section key={i} className={`bj-spot ${isLive ? 'active' : ''} ${spots[i]! > 0 || list.length ? 'on' : ''}`}>
              <header>
                <strong>Main {i + 1}</strong>
                {phase === 'idle' ? (
                  <div className="bj-spot-bet">
                    <input
                      type="number"
                      min={0}
                      max={cash}
                      value={spots[i] || ''}
                      placeholder="0"
                      onChange={(e) => setSpot(i, Number(e.target.value))}
                    />
                    <span>LC</span>
                  </div>
                ) : (
                  <em>{list.length ? `${list.reduce((s, h) => s + h.bet, 0)} LC` : '—'}</em>
                )}
              </header>
              {phase === 'idle' && (
                <div className="bj-spot-presets">
                  {PRESETS.filter((v) => v <= cash).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`chip ${spots[i] === v ? 'active' : ''}`}
                      onClick={() => {
                        setSpot(i, v)
                        setStake(v)
                      }}
                    >
                      {v >= 1000 ? `${v / 1000}k` : v}
                    </button>
                  ))}
                  <button type="button" className="chip" onClick={() => setSpot(i, 0)}>
                    Vide
                  </button>
                </div>
              )}
              <div className="bj-spot-hands">
                {list.length === 0 && <div className="bj-empty">Mise optionnelle</div>}
                {list.map((h) => (
                  <div
                    key={h.id}
                    className={`bj-hand ${hands[active]?.id === h.id && phase === 'player' ? 'active' : ''}`}
                  >
                    <div className="bj-label">
                      {handValue(h.cards)} · {formatMoney(h.bet)} LC
                      {h.fromSplit ? ' · split' : ''}
                    </div>
                    <div className="bj-cards">
                      {h.cards.map((c, ci) => (
                        <PlayingCard key={c.id} card={c} dealDelay={ci * 90} back={back} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
