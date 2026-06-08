export type GameStatus = 'playing' | 'won' | 'lost';

export class GameState {
  lives: number;
  status: GameStatus;

  constructor(startingLives: number) {
    this.lives = startingLives;
    this.status = 'playing';
  }

  loseLife(amount: number): void {
    this.lives -= amount;
    if (this.lives <= 0) {
      this.lives = 0;
      this.status = 'lost';
    }
  }

  win(): void {
    if (this.status === 'playing') {
      this.status = 'won';
    }
  }
}
