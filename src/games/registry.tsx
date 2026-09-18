import type { ReactNode } from 'react'
import { RouletteGame } from './Roulette'
import { SlotsGame } from './Slots'
import { BlackjackGame } from './Blackjack'
import { DiceGame } from './Dice'
import { CrashGame } from './Crash'
import { WheelGame } from './Wheel'
import { BaccaratGame } from './Baccarat'
import { PlinkoGame } from './Plinko'
import { MinesGame } from './Mines'
import { PokerGame } from './Poker'
import { HoldemGame } from './Holdem'
import { HiLoGame } from './HiLo'
import { KenoGame } from './Keno'
import type { GameId } from '../types'

export const GAME_COMPONENTS: Record<GameId, () => ReactNode> = {
  roulette: () => <RouletteGame />,
  slots: () => <SlotsGame />,
  blackjack: () => <BlackjackGame />,
  dice: () => <DiceGame />,
  crash: () => <CrashGame />,
  wheel: () => <WheelGame />,
  baccarat: () => <BaccaratGame />,
  plinko: () => <PlinkoGame />,
  mines: () => <MinesGame />,
  poker: () => <PokerGame />,
  holdem: () => <HoldemGame />,
  hilo: () => <HiLoGame />,
  keno: () => <KenoGame />,
}
