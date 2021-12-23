export class ProgressBar {
  constructor(maxProgress, nowProgress = 0) {
    this.progressMaxSymbols = (process.stdout.columns - 2);
    this.maxProgress = (maxProgress) ? maxProgress : this.progressMaxSymbols;
    this.nowProgress = nowProgress;
  }

  writeProgress = () => {
    const progressSymCount = Math.round(this.progressMaxSymbols * this.nowProgress / this.maxProgress);

    let progressString = `[`;
    for (let j = 0; j < progressSymCount; j++) {
      progressString += `■`;
    }
    for (let j = progressSymCount; j < this.progressMaxSymbols; j++) {
      progressString += ` `;
    }
    progressString += `]`;

    process.stdout.write(progressString);
  }

  rewriteProgress = () => {
    const readline = require(`readline`);
    readline.cursorTo(process.stdout, 0);
    this.writeProgress();
  }

  setProgress = (nowProgress) => {
    this.nowProgress = nowProgress;
  }

  incProgress = () => (this.nowProgress !== this.maxProgress) ? this.nowProgress++ : undefined;

  incAndRewrite = () => {
    this.incProgress();
    this.rewriteProgress();
  }

  rewriteAndInc = () => {
    this.rewriteProgress();
    this.incProgress();
  }
}
