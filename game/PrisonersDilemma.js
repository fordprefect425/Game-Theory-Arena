/**
 * Prisoner's Dilemma — Core Game Logic
 *
 * Payoff matrix (row = Player A, col = Player B):
 *   Cooperate / Cooperate → 3 / 3
 *   Cooperate / Defect    → 0 / 5
 *   Defect    / Cooperate → 5 / 0
 *   Defect    / Defect    → 1 / 1
 */

const PAYOFF_MATRIX = {
  'cooperate:cooperate': [3, 3],
  'cooperate:defect':    [0, 5],
  'defect:cooperate':    [5, 0],
  'defect:defect':       [1, 1],
};

class PrisonersDilemma {
  /**
   * @param {string} player1Id
   * @param {string} player2Id
   * @param {number} totalRounds
   */
  constructor(player1Id, player2Id, totalRounds = 5) {
    this.player1Id = player1Id;
    this.player2Id = player2Id;
    this.totalRounds = totalRounds;

    this.currentRound = 1;
    this.scores = { [player1Id]: 0, [player2Id]: 0 };
    this.history = [];                // array of round results
    this.pendingChoices = {};         // playerId → 'cooperate' | 'defect'
    this.finished = false;
  }

  /**
   * Submit a choice for the current round.
   * @param {string} playerId
   * @param {'cooperate'|'defect'} choice
   * @returns {null|object} `null` if waiting for the other player,
   *   otherwise the round result object.
   */
  submitChoice(playerId, choice) {
    if (this.finished) return null;
    if (playerId !== this.player1Id && playerId !== this.player2Id) return null;
    if (choice !== 'cooperate' && choice !== 'defect') return null;
    if (this.pendingChoices[playerId]) return null; // already submitted

    this.pendingChoices[playerId] = choice;

    // Both players have submitted → resolve
    if (this.pendingChoices[this.player1Id] && this.pendingChoices[this.player2Id]) {
      return this._resolveRound();
    }
    return null;
  }

  /** @private */
  _resolveRound() {
    const c1 = this.pendingChoices[this.player1Id];
    const c2 = this.pendingChoices[this.player2Id];
    const key = `${c1}:${c2}`;
    const [p1Pay, p2Pay] = PAYOFF_MATRIX[key];

    this.scores[this.player1Id] += p1Pay;
    this.scores[this.player2Id] += p2Pay;

    const roundResult = {
      round: this.currentRound,
      choices: {
        [this.player1Id]: c1,
        [this.player2Id]: c2,
      },
      payoffs: {
        [this.player1Id]: p1Pay,
        [this.player2Id]: p2Pay,
      },
      scores: { ...this.scores },
    };

    this.history.push(roundResult);
    this.pendingChoices = {};
    this.currentRound++;

    if (this.currentRound > this.totalRounds) {
      this.finished = true;
    }

    return roundResult;
  }

  getScores() {
    return { ...this.scores };
  }

  isFinished() {
    return this.finished;
  }

  getHistory() {
    return [...this.history];
  }

  getCurrentRound() {
    return this.currentRound;
  }

  getTotalRounds() {
    return this.totalRounds;
  }

  /**
   * @returns {string} winning player ID or 'draw'
   */
  getWinner() {
    const s1 = this.scores[this.player1Id];
    const s2 = this.scores[this.player2Id];
    if (s1 > s2) return this.player1Id;
    if (s2 > s1) return this.player2Id;
    return 'draw';
  }
}

module.exports = PrisonersDilemma;
