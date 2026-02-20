const DEFAULT_THRESHOLD = 5;

export class CircuitBreaker {
  private errorHistory: string[] = [];
  private readonly threshold: number;

  constructor(threshold: number = DEFAULT_THRESHOLD) {
    this.threshold = threshold;
  }

  record(error: string): boolean {
    this.errorHistory.push(error);

    if (this.errorHistory.length > this.threshold) {
      this.errorHistory.shift();
    }

    if (this.errorHistory.length < this.threshold) {
      return false;
    }

    return this.errorHistory.every((e) => e === this.errorHistory[0]);
  }

  reset(): void {
    this.errorHistory = [];
  }
}
