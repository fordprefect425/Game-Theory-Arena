/**
 * Ultimatum Game — Core Game Logic
 *
 * Game structure:
 *   Round 1: Player1 proposes split (0-10), Player2 accepts/rejects
 *   Round 2: Player2 proposes split (0-10), Player1 accepts/rejects
 *
 * Scoring:
 *   Accept → Both get the split
 *   Reject → Both get 0
 */

class UltimatumGame {
  /**
   * @param {string} player1Id
   * @param {string} player2Id
   */
  constructor(player1Id, player2Id) {
    this.player1Id = player1Id;
    this.player2Id = player2Id;
    this.totalRounds = 2;

    this.currentRound = 1;
    this.currentProposerId = player1Id; // Round 1: player1 proposes
    this.currentResponderId = player2Id;

    this.scores = { [player1Id]: 0, [player2Id]: 0 };
    this.history = [];
    this.pendingProposal = null; // { proposerSplit, responderSplit }
    this.finished = false;
  }

  /**
   * Proposer submits a split (how much they keep)
   * @param {string} playerId
   * @param {number} proposerSplit - Points proposer keeps (0-10)
   * @returns {object|null} Proposal details or null if invalid
   */
  submitProposal(playerId, proposerSplit) {
    if (this.finished) return null;
    if (playerId !== this.currentProposerId) return null;
    if (this.pendingProposal) return null; // Already proposed
    if (proposerSplit < 0 || proposerSplit > 10 || !Number.isInteger(proposerSplit)) return null;

    const responderSplit = 10 - proposerSplit;
    this.pendingProposal = { proposerSplit, responderSplit };

    return {
      type: 'proposal-submitted',
      round: this.currentRound,
      proposerId: this.currentProposerId,
      responderId: this.currentResponderId,
      proposerSplit,
      responderSplit,
    };
  }

  /**
   * Responder accepts or rejects the proposal
   * @param {string} playerId
   * @param {boolean} accepted
   * @returns {object|null} Round result or null if invalid
   */
  submitResponse(playerId, accepted) {
    if (this.finished) return null;
    if (playerId !== this.currentResponderId) return null;
    if (!this.pendingProposal) return null; // No proposal yet

    const { proposerSplit, responderSplit } = this.pendingProposal;
    let proposerPoints = 0;
    let responderPoints = 0;

    if (accepted) {
      proposerPoints = proposerSplit;
      responderPoints = responderSplit;
    }
    // If rejected, both get 0 (already initialized above)

    this.scores[this.currentProposerId] += proposerPoints;
    this.scores[this.currentResponderId] += responderPoints;

    const roundResult = {
      round: this.currentRound,
      proposerId: this.currentProposerId,
      responderId: this.currentResponderId,
      proposerSplit,
      responderSplit,
      accepted,
      proposerPoints,
      responderPoints,
      scores: { ...this.scores },
    };

    this.history.push(roundResult);
    this.pendingProposal = null;

    // Move to next round or finish
    if (this.currentRound >= this.totalRounds) {
      this.finished = true;
    } else {
      this.currentRound++;
      // Swap roles
      [this.currentProposerId, this.currentResponderId] = [this.currentResponderId, this.currentProposerId];
    }

    return roundResult;
  }

  getCurrentProposerId() {
    return this.currentProposerId;
  }

  getCurrentResponderId() {
    return this.currentResponderId;
  }

  getPendingProposal() {
    return this.pendingProposal;
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

module.exports = UltimatumGame;
