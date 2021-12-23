export class Analytics {
  private fetchTimeStart = 0;

  readonly global = {
    removed: 0,
    placed: 0,
  };

  readonly local = {
    removed: 0,
    placed: 0,
    fetchTime: 0.
  };

  readonly streak = {
    max: 0,
    current: 0,
  };

  private average = {};

  incPlaced = (): void => {
    this.local.placed += 1;
    this.global.placed += 1;
    this.streak.current += 1;
  };

  incRemoved = (): void => {
    this.local.removed += 1;
    this.global.removed += 1;
    this.streak.max = Math.max(this.streak.max, this.streak.current);
    this.streak.current = 0;
  };

  startRecordingFetchTime = (): void => {
    this.fetchTimeStart = new Date().getTime();
  }

  stopRecordingFetchTime = (): void => {
    this.local.fetchTime = (new Date().getTime() - this.fetchTimeStart) / 1000;
    this.fetchTimeStart = 0;
  }

  resetLocal = (): void => {
    this.local.placed = 0;
    this.local.removed = 0;
    this.local.fetchTime = 0.;
  }

}