/**
 * LEXASSIST — AI Lawyer Rating Engine
 * Calculates lawyer rating based on:
 * - Case success rate
 * - Average case risk handled
 * - Average time to resolve
 * - Citizen reviews
 * - Priority cases handled
 */

const Case   = require('../models/Case');
const Lawyer = require('../models/Lawyer');
const { Review } = require('../models/Extras');

const calculateLawyerRating = async (lawyerId) => {
  try {
    const cases = await Case.find({ lawyer: lawyerId });
    if (!cases.length) return 0;

    // 1. Case success rate (max 5 points)
    const closed   = cases.filter(c => ['Closed','Dismissed'].includes(c.status));
    const won      = cases.filter(c => c.outcome === 'Won' || c.outcome === 'Settled');
    const successRate = closed.length > 0 ? (won.length / closed.length) * 100 : 0;
    const successScore = (successRate / 100) * 5;

    // 2. Average case risk handled (max 5 points — higher risk = better score)
    const avgRisk = cases.reduce((s,c) => s + (c.priorityParams?.caseRisk||0), 0) / cases.length;
    const riskScore = (avgRisk / 10) * 5;

    // 3. Time to resolve (max 5 points — faster = better)
    const closedWithTime = closed.filter(c => c.timeTakenDays);
    const avgDays = closedWithTime.length
      ? closedWithTime.reduce((s,c) => s + c.timeTakenDays, 0) / closedWithTime.length
      : 180;
    const timeScore = avgDays <= 30 ? 5 : avgDays <= 90 ? 4 : avgDays <= 180 ? 3 : avgDays <= 365 ? 2 : 1;

    // 4. Citizen reviews (max 5 points)
    const reviews   = await Review.find({ lawyer: lawyerId });
    const avgReview = reviews.length ? reviews.reduce((s,r) => s+r.rating,0)/reviews.length : 0;
    const reviewScore = avgReview;

    // 5. Priority cases handled (max 5 points)
    const highPriority = cases.filter(c => ['Critical','High'].includes(c.priority)).length;
    const priorityScore = Math.min((highPriority / Math.max(cases.length, 1)) * 10, 5);

    // Weighted average (out of 5)
    const aiRating = (
      successScore  * 0.30 +  // 30% weight
      riskScore     * 0.20 +  // 20% weight
      timeScore     * 0.15 +  // 15% weight
      reviewScore   * 0.25 +  // 25% weight
      priorityScore * 0.10    // 10% weight
    );

    // Update lawyer record
    await Lawyer.findOneAndUpdate(
      { user: lawyerId },
      {
        aiRating: Math.round(aiRating * 10) / 10,
        aiRatingBreakdown: {
          caseSuccessRate:      Math.round(successRate),
          avgCaseRisk:          Math.round(avgRisk * 10) / 10,
          avgTimeToResolve:     Math.round(avgDays),
          citizenRating:        Math.round(avgReview * 10) / 10,
          priorityCasesHandled: highPriority,
        },
        aiRatingLastUpdated: new Date(),
        totalCases:  cases.length,
        closedCases: closed.length,
        wonCases:    won.length,
      }
    );

    return Math.round(aiRating * 10) / 10;
  } catch(err) {
    console.error('Lawyer rating error:', err.message);
    return 0;
  }
};

module.exports = { calculateLawyerRating };
