// Fictional operating scenarios only. Record IDs and uploaded evidence stay with the user.
const scenarios = [
  [/subscription|personalization/i, [
    'A neighborhood laundry has 80 recurring households. Compare weekly and biweekly pickup plans for a household sending two bags per week; explain price, capacity, and pause assumptions.',
    'A customer wants to pause pickups for six summer weeks and add shirt pressing afterward. Draft a reviewable retention offer and identify the account facts staff must confirm.',
    'Compare monthly, biweekly, and weekly service for a family whose volume varies from one to three bags. Include add-ons, likely tradeoffs, and the data needed before changing a real subscription.',
  ]],
  [/driver.earnings|fairness/i, [
    'Review an illustrative delivery shift with 12 stops, 42 miles, six hours, and two failed pickups. Suggest ways to reduce unpaid time without assuming a real driver record.',
    'Compare two fictional driver routes: 10 dense downtown stops versus 14 suburban stops over a longer distance. Explain fair earnings measures and missing evidence.',
    'Draft a weekly earnings review for a laundry delivery team with evening peaks and variable tips. Include route, mileage, wait time, and fairness checks.',
  ]],
  [/fabric.care|care.label|compliance/i, [
    'A customer brings a wool sweater labeled cold hand wash and flat dry. Explain a safe intake review, label checks, and when staff should escalate.',
    'A mixed order contains silk blouses, cotton shirts, and a linen jacket. Propose separate care steps and note which labels must be inspected first.',
    'A garment label is partly unreadable after repeated cleaning. Outline a conservative care decision, documentation, and customer communication.',
  ]],
  [/sustainab|environmental|water.chemical/i, [
    'A laundry processes 200 loads a week using 25 gallons per load. Suggest practical water savings measures and a way to validate the baseline.',
    'Compare two fictional washers with different water and energy use for a busy weekend shift. Include assumptions and a measurement plan.',
    'Draft a monthly sustainability review for detergent, water, and electricity use. Separate measured facts from estimates and propose follow-up checks.',
  ]],
  [/damage|shrinkage|claim|insurance|guarantee/i, [
    'A cotton shirt is reported damaged after pickup. Outline evidence to collect, condition at intake, chain of custody, and independent review before any decision.',
    'A customer reports a wool sweater shrank after cleaning. Explain possible causes, missing care-label facts, documentation, and fair next steps.',
    'Draft a review checklist for an illustrative lost garment complaint with no verified inventory match. Include customer communication and escalation.',
  ]],
  [/corporate|b2b|bulk.order|contract/i, [
    'A small hotel requests weekly cleaning for 120 towels and 60 sheets. Draft service questions, capacity checks, and a quotation outline.',
    'A restaurant group needs uniforms cleaned twice weekly at three locations. Compare pickup schedules, quality checks, and contract terms for review.',
    'Prepare a bulk laundry onboarding plan for a fictional clinic with variable weekly volume. Include handling requirements and unanswered compliance questions.',
  ]],
  [/equipment|supplier|marketplace/i, [
    'A laundry needs to replace a washer that handles 30 loads daily. Compare repair, lease, and purchase factors using illustrative assumptions.',
    'Draft a supplier evaluation for detergent dispensers across two locations, including service response, consumables, and warranty questions.',
    'Plan equipment procurement for a peak season capacity increase. Include throughput, installation, maintenance, and total cost checks.',
  ]],
  [/referral/i, [
    'Design a referral offer for a neighborhood laundry with 80 repeat customers, including eligibility, abuse checks, and a small trial.',
    'Compare a fixed credit and percentage discount for a fictional wash-and-fold referral campaign. Estimate tradeoffs and measurement needs.',
    'Draft an operations review for a referral campaign with low redemption and high first-order discounts. Suggest adjustments and guardrails.',
  ]],
  [/laundromat.partner|network/i, [
    'Evaluate a fictional partner laundromat for overflow work, including capacity, quality checks, turnaround, and customer data handling.',
    'Plan a partner handoff for 40 weekend loads when one facility is unavailable. Include traceability and escalation steps.',
    'Compare two potential laundry partners by distance, service reliability, equipment, and documented quality controls.',
  ]],
];

export function laundryPromptPresets(label) {
  const prompts = scenarios.find(([pattern]) => pattern.test(label))?.[1] || [
    'A neighborhood laundry has a busy weekend and a modest staffing budget. Identify the facts needed and propose a practical first review.',
    'Compare two ways to improve pickup reliability for a laundry service with 100 weekly orders. Include assumptions, tradeoffs, and success measures.',
    'Prepare an operations plan for a growing laundry service with variable demand. Include timing, responsibilities, risks, and evidence to collect.',
  ];
  return prompts.map((prompt, index) => ({ name: ['Quick brief', 'Team planning', 'Detailed review'][index], prompt }));
}
