const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
  callOpenRouter,
  parseAIJson,
  persistAIResult,
  aiRateLimiter,
  DEFAULT_MODEL,
  DEFAULT_VISION_MODEL,
} = require('../utils/aiHelpers');

const router = express.Router();
const prisma = new PrismaClient();

// All AI endpoints share the per-user 20/hr limiter.
router.use(aiRateLimiter);

// ============================================================================
// AI Order Estimator — supports real vision when imageBase64 is provided.
// ============================================================================
router.post('/estimate', optionalAuth, async (req, res) => {
  const t0 = Date.now();
  const { imageBase64, description } = req.body;

  if (!description && !imageBase64) {
    return res.status(400).json({ error: 'Please provide a description or image' });
  }

  try {
    const [services, garments] = await Promise.all([
      prisma.service.findMany({ where: { isActive: true }, select: { name: true, basePrice: true } }),
      prisma.garmentType.findMany({ where: { isActive: true }, select: { name: true, basePrice: true, category: true } }),
    ]);

    const prompt = `You are a laundry service AI assistant. Analyze the provided laundry order ${
      imageBase64 ? 'photo' : 'description'
    } and estimate the items and costs.

Available garment types with base prices:
${garments.map((g) => `- ${g.name} (${g.category}): $${g.basePrice}`).join('\n')}

${description ? `Customer description: "${description}"\n` : ''}
Respond ONLY with valid JSON in this format (no markdown, no explanation):
{
  "items": [{"name":"garment","service":"Dry Cleaning","quantity":1,"price":5.99,"bbox":[x,y,w,h]}],
  "totalEstimate": 25.99,
  "confidence": 0.85,
  "notes": "Brief note"
}
The "bbox" field is optional and only meaningful if you analyzed an image (normalized 0..1).`;

    let messages;
    let modelUsed;

    if (imageBase64) {
      // Real vision: send the image to a vision-capable model.
      modelUsed = DEFAULT_VISION_MODEL;
      const imageUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;
      messages = [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ];
    } else {
      modelUsed = DEFAULT_MODEL;
      messages = [{ role: 'user', content: prompt }];
    }

    let estimatedItems = [];
    let totalEstimate = 0;
    let confidence = 0.85;
    let notes = '';
    let aiPowered = true;

    try {
      const aiResponse = await callOpenRouter(messages, { model: modelUsed, maxTokens: 700 });
      const parsed = parseAIJson(aiResponse);
      estimatedItems = parsed.items || [];
      totalEstimate =
        parsed.totalEstimate ||
        estimatedItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
      confidence = parsed.confidence ?? 0.85;
      notes = parsed.notes || '';
    } catch (parseError) {
      aiPowered = false;
      console.warn(`⚠️  AI estimation failed, using fallback: ${parseError.message}`);
      const words = (description || '').toLowerCase();
      if (words.includes('shirt')) estimatedItems.push({ name: 'Dress Shirt', service: 'Dry Cleaning', quantity: 1, price: 5.99 });
      if (words.includes('pants') || words.includes('trousers')) estimatedItems.push({ name: 'Pants', service: 'Dry Cleaning', quantity: 1, price: 7.99 });
      if (words.includes('suit') || words.includes('jacket')) estimatedItems.push({ name: 'Suit Jacket', service: 'Dry Cleaning', quantity: 1, price: 12.99 });
      if (words.includes('dress')) estimatedItems.push({ name: 'Dress', service: 'Dry Cleaning', quantity: 1, price: 14.99 });
      if (words.includes('blouse')) estimatedItems.push({ name: 'Blouse', service: 'Dry Cleaning', quantity: 1, price: 6.99 });
      if (estimatedItems.length === 0) {
        estimatedItems.push({ name: 'Dress Shirt', service: 'Dry Cleaning', quantity: 2, price: 5.99 });
        estimatedItems.push({ name: 'Pants', service: 'Dry Cleaning', quantity: 2, price: 7.99 });
      }
      totalEstimate = estimatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      notes = 'Estimate based on keyword matching (AI unavailable)';
    }

    const aiEstimate = await prisma.aIEstimate.create({
      data: {
        customerId: req.user?.id,
        imageUrl: imageBase64 ? 'base64_image' : null,
        description,
        estimatedItems,
        totalEstimate,
        confidence,
      },
    });

    await persistAIResult(prisma, {
      feature: 'estimate',
      model: modelUsed,
      userId: req.user?.id,
      input: { description, hasImage: !!imageBase64 },
      output: { items: estimatedItems, totalEstimate, confidence, notes },
      success: aiPowered,
      latencyMs: Date.now() - t0,
    });

    res.json({
      id: aiEstimate.id,
      items: estimatedItems,
      totalEstimate,
      confidence,
      notes,
      aiPowered,
      visionUsed: !!imageBase64 && aiPowered,
      message: 'AI estimate generated successfully',
    });
  } catch (error) {
    await persistAIResult(prisma, {
      feature: 'estimate',
      model: imageBase64 ? DEFAULT_VISION_MODEL : DEFAULT_MODEL,
      userId: req.user?.id,
      input: { description, hasImage: !!imageBase64 },
      output: null,
      success: false,
      errorMessage: error.message,
      latencyMs: Date.now() - t0,
    });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AI Route Optimizer — capacity & traffic aware (best-effort heuristic + AI)
// ============================================================================
router.post('/optimize-route', authenticateToken, async (req, res) => {
  const t0 = Date.now();
  try {
    const { stops, vehicleCapacity, currentTrafficNote } = req.body;
    if (!stops || stops.length < 2) {
      return res.status(400).json({ error: 'At least 2 stops required for optimization' });
    }

    const prompt = `You are a route optimization AI for a laundry pickup/delivery fleet.
Vehicle capacity (orders): ${vehicleCapacity || 'unspecified'}
Traffic note: ${currentTrafficNote || 'normal traffic'}

Stops:
${stops.map((s, i) => `${i}. ${s.type || 'stop'} at (${s.lat}, ${s.lng}) priority=${s.priority || 'normal'} weight=${s.weight || 1}`).join('\n')}

Re-sequence the stops to minimize total drive time AND respect capacity.
If a stop must be split into a second trip, return its index in "deferred".

Respond ONLY with JSON:
{
  "order": [0,2,1,3],
  "deferred": [],
  "etas": [{"index":0,"etaMinutes":12}],
  "rationale": "brief"
}`;

    let optimizedRoute = [...stops];
    let deferred = [];
    let etas = [];
    let rationale = '';
    let aiPowered = true;

    try {
      const ai = await callOpenRouter([{ role: 'user', content: prompt }], { maxTokens: 400 });
      const parsed = parseAIJson(ai);
      if (Array.isArray(parsed.order)) {
        optimizedRoute = parsed.order.map((i) => stops[i]).filter(Boolean);
        deferred = (parsed.deferred || []).map((i) => stops[i]).filter(Boolean);
        etas = parsed.etas || [];
        rationale = parsed.rationale || '';
      }
    } catch (e) {
      aiPowered = false;
      // Nearest-neighbor fallback
      const remaining = [...stops];
      optimizedRoute = [];
      let current = remaining.shift();
      optimizedRoute.push(current);
      while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        remaining.forEach((stop, index) => {
          const distance = Math.sqrt(
            Math.pow(stop.lat - current.lat, 2) + Math.pow(stop.lng - current.lng, 2)
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });
        current = remaining.splice(nearestIndex, 1)[0];
        optimizedRoute.push(current);
      }
    }

    const calcDist = (route) =>
      route.reduce((sum, stop, i) => {
        if (i === 0) return 0;
        return sum + Math.sqrt(Math.pow(stop.lat - route[i - 1].lat, 2) + Math.pow(stop.lng - route[i - 1].lng, 2));
      }, 0);

    const originalDistance = calcDist(stops);
    const optimizedDistance = calcDist(optimizedRoute);
    const savings = originalDistance > 0
      ? ((originalDistance - optimizedDistance) / originalDistance * 100).toFixed(1)
      : 0;

    // Broadcast re-routed ETA on Socket.IO if available
    try {
      const io = req.app.get('io');
      if (io && req.body.routeId) {
        io.to(`route:${req.body.routeId}`).emit('route:reoptimized', {
          routeId: req.body.routeId,
          order: optimizedRoute,
          etas,
          timestamp: new Date(),
        });
      }
    } catch (_) {}

    await persistAIResult(prisma, {
      feature: 'optimize-route',
      model: DEFAULT_MODEL,
      userId: req.user?.id,
      input: { stops, vehicleCapacity, currentTrafficNote },
      output: { order: optimizedRoute, deferred, etas, rationale, savings },
      success: aiPowered,
      latencyMs: Date.now() - t0,
    });

    res.json({
      optimizedRoute,
      deferred,
      etas,
      rationale,
      estimatedSavings: `${savings}%`,
      totalStops: optimizedRoute.length,
      aiPowered,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AI Stain Identifier — supports vision when imageBase64 is provided
// ============================================================================
router.post('/identify-stain', optionalAuth, async (req, res) => {
  const t0 = Date.now();
  const { imageBase64, description, orderItemId } = req.body;

  if (!description && !imageBase64) {
    return res.status(400).json({ error: 'Please provide a description or image of the stain' });
  }

  try {
    const prompt = `You are a professional laundry stain identification AI. Analyze the stain ${
      imageBase64 ? 'photo' : 'description'
    } and provide treatment recommendations.

${description ? `Stain description: "${description}"\n` : ''}

Respond ONLY with JSON:
{
  "stainType": "type",
  "treatment": "detailed plan",
  "expectedSuccessRate": 85,
  "warnings": ["..."],
  "alternativeTreatments": ["..."]
}`;

    let modelUsed = DEFAULT_MODEL;
    let messages;
    if (imageBase64) {
      modelUsed = DEFAULT_VISION_MODEL;
      const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      messages = [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ];
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    let stainAnalysis = {
      stainType: 'Unknown',
      treatment: 'Professional cleaning recommended',
      expectedSuccessRate: 80,
      warnings: [],
      alternativeTreatments: [],
    };
    let aiPowered = true;

    try {
      const aiResponse = await callOpenRouter(messages, { model: modelUsed, maxTokens: 500 });
      stainAnalysis = parseAIJson(aiResponse);
    } catch (e) {
      aiPowered = false;
      const words = (description || '').toLowerCase();
      const stainTypes = {
        coffee: { type: 'Coffee', treatment: 'Pre-treat with enzyme cleaner, cold water wash', rate: 95 },
        wine: { type: 'Wine', treatment: 'Apply salt immediately; cold water + white vinegar', rate: 85 },
        grease: { type: 'Grease/Oil', treatment: 'Apply dish soap, sit 30 min, hot water wash', rate: 90 },
        oil: { type: 'Grease/Oil', treatment: 'Apply dish soap, sit 30 min, hot water wash', rate: 90 },
        ink: { type: 'Ink', treatment: 'Apply rubbing alcohol, blot, cold rinse', rate: 75 },
        blood: { type: 'Blood', treatment: 'Cold water soak, enzyme detergent, no heat', rate: 92 },
        grass: { type: 'Grass', treatment: 'Enzyme pre-treatment, warm water wash', rate: 88 },
        sweat: { type: 'Sweat', treatment: 'Enzyme cleaner or white vinegar, warm water', rate: 95 },
      };
      for (const [keyword, data] of Object.entries(stainTypes)) {
        if (words.includes(keyword)) {
          stainAnalysis = {
            stainType: data.type,
            treatment: data.treatment,
            expectedSuccessRate: data.rate,
            warnings: [],
            alternativeTreatments: [],
          };
          break;
        }
      }
    }

    const analysis = await prisma.aIStainAnalysis.create({
      data: {
        orderItemId,
        imageUrl: imageBase64 ? 'base64_image' : null,
        stainType: stainAnalysis.stainType,
        treatment: stainAnalysis.treatment,
        confidence: stainAnalysis.expectedSuccessRate / 100,
      },
    });

    await persistAIResult(prisma, {
      feature: 'identify-stain',
      model: modelUsed,
      userId: req.user?.id,
      input: { description, hasImage: !!imageBase64, orderItemId },
      output: stainAnalysis,
      success: aiPowered,
      latencyMs: Date.now() - t0,
    });

    res.json({
      id: analysis.id,
      stainType: stainAnalysis.stainType,
      treatment: stainAnalysis.treatment,
      expectedSuccessRate: `${stainAnalysis.expectedSuccessRate}%`,
      confidence: (stainAnalysis.expectedSuccessRate / 100).toFixed(2),
      warnings: stainAnalysis.warnings || [],
      alternativeTreatments: stainAnalysis.alternativeTreatments || [],
      aiPowered,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AI Customer Service Bot
// ============================================================================
router.post('/chat', optionalAuth, async (req, res) => {
  const t0 = Date.now();
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    await prisma.aIChatHistory.create({
      data: { customerId: req.user?.id, sessionId, role: 'user', message },
    });

    const history = await prisma.aIChatHistory.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const systemPrompt = `You are a helpful customer service AI for "Laundry Services".
- Services: Dry cleaning, laundry, wash & fold, pressing, alterations
- Pricing: Shirts from $5.99, pants from $7.99, suits from $12.99
- Rush: 50% surcharge, same-day or next morning
- Pickup/Delivery: free, 7am-7pm any day
- Hours: Mon-Fri 7am-7pm, Sat 8am-5pm, Sun 10am-4pm
Be friendly, concise, helpful.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.message })),
      { role: 'user', content: message },
    ];

    let response;
    let aiPowered = true;
    try {
      response = await callOpenRouter(messages, { maxTokens: 400 });
    } catch (e) {
      aiPowered = false;
      const lower = message.toLowerCase();
      if (lower.includes('price') || lower.includes('cost')) {
        response = 'Dry cleaning starts at $5.99 for shirts and $7.99 for pants. Want a detailed quote?';
      } else if (lower.includes('pickup') || lower.includes('delivery')) {
        response = 'Free pickup and delivery, daily 7am-7pm. Typically 24-48h turnaround.';
      } else if (lower.includes('hours') || lower.includes('open')) {
        response = 'Mon-Fri 7am-7pm, Sat 8am-5pm, Sun 10am-4pm.';
      } else {
        response = 'Happy to help! What do you need? Pricing, scheduling, or order status?';
      }
    }

    await prisma.aIChatHistory.create({
      data: { customerId: req.user?.id, sessionId, role: 'assistant', message: response },
    });

    await persistAIResult(prisma, {
      feature: 'chat',
      model: DEFAULT_MODEL,
      userId: req.user?.id,
      input: { sessionId, message },
      output: { response },
      success: aiPowered,
      latencyMs: Date.now() - t0,
    });

    res.json({ response, sessionId, aiPowered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chat history (paginated)
router.get('/chat/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      prisma.aIChatHistory.findMany({
        where: { sessionId: req.params.sessionId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.aIChatHistory.count({ where: { sessionId: req.params.sessionId } }),
    ]);
    res.json({ messages, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AI Demand Predictor (with fallback)
// ============================================================================
router.get('/predict-demand', authenticateToken, async (req, res) => {
  const t0 = Date.now();
  try {
    const { locationId, days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const historicalOrders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, total: true, status: true },
    });

    const dailyStats = {};
    historicalOrders.forEach((o) => {
      const k = new Date(o.createdAt).toISOString().split('T')[0];
      if (!dailyStats[k]) dailyStats[k] = { orders: 0, revenue: 0 };
      dailyStats[k].orders++;
      dailyStats[k].revenue += parseFloat(o.total);
    });
    const summary = Object.entries(dailyStats).map(([date, s]) => ({
      date, dayOfWeek: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
      orders: s.orders, revenue: s.revenue.toFixed(2),
    }));

    let predictions = [];
    let insights;
    let aiPowered = true;

    try {
      const prompt = `You are a demand forecaster. Predict the next ${days} days based on this 30-day history.
${JSON.stringify(summary, null, 2)}
Today: ${new Date().toISOString().split('T')[0]}
Respond ONLY with JSON: {"predictions":[{"date":"YYYY-MM-DD","dayOfWeek":"Mon","predictedOrders":15,"predictedRevenue":750,"confidence":0.85,"reasoning":"…"}],"insights":"…"}`;
      const ai = await callOpenRouter([{ role: 'user', content: prompt }], { maxTokens: 900 });
      const parsed = parseAIJson(ai);
      predictions = parsed.predictions || [];
      insights = parsed.insights;
      for (const p of predictions) {
        try {
          await prisma.aIDemandPrediction.create({
            data: {
              locationId,
              date: new Date(p.date),
              predictedOrders: p.predictedOrders,
              predictedRevenue: p.predictedRevenue,
              confidence: p.confidence,
            },
          });
        } catch (_) {}
      }
    } catch (e) {
      aiPowered = false;
      const dayAvg = {};
      historicalOrders.forEach((o) => {
        const d = new Date(o.createdAt).getDay();
        if (!dayAvg[d]) dayAvg[d] = { count: 0, revenue: 0 };
        dayAvg[d].count++;
        dayAvg[d].revenue += parseFloat(o.total);
      });
      for (let i = 0; i < parseInt(days); i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dow = date.getDay();
        const a = dayAvg[dow] || { count: 0, revenue: 0 };
        const baseOrders = Math.round(a.count / 4) || 10;
        const baseRev = a.count > 0 ? (a.revenue / a.count) * baseOrders : 500;
        predictions.push({
          date: date.toISOString().split('T')[0],
          dayOfWeek: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow],
          predictedOrders: baseOrders,
          predictedRevenue: parseFloat(baseRev.toFixed(2)),
          confidence: 0.65,
        });
      }
    }

    await persistAIResult(prisma, {
      feature: 'predict-demand', model: DEFAULT_MODEL, userId: req.user?.id,
      input: { locationId, days }, output: { predictions, insights }, success: aiPowered,
      latencyMs: Date.now() - t0,
    });

    res.json({
      predictions, insights,
      summary: {
        totalPredictedOrders: predictions.reduce((s, p) => s + p.predictedOrders, 0),
        totalPredictedRevenue: predictions.reduce((s, p) => s + p.predictedRevenue, 0),
        peakDay: predictions.reduce((max, p) => p.predictedOrders > max.predictedOrders ? p : max, predictions[0]),
      },
      aiPowered,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AI Maintenance Predictor (preserved, instrumented)
// ============================================================================
router.get('/predict-maintenance', authenticateToken, async (req, res) => {
  const t0 = Date.now();
  try {
    const machines = await prisma.machine.findMany({
      include: {
        usages: { orderBy: { startTime: 'desc' }, take: 100 },
        maintenances: { orderBy: { completedDate: 'desc' }, take: 5 },
      },
    });

    const machineData = machines.map((m) => ({
      id: m.machineNumber,
      type: m.type,
      brand: m.brand,
      model: m.model,
      status: m.status,
      totalCycles: m.totalCycles,
      recentUsages: m.usages.length,
      lastMaintenance: m.maintenances[0]?.completedDate,
      maintenanceHistory: m.maintenances.map((mt) => ({
        type: mt.type, date: mt.completedDate, cost: parseFloat(mt.cost || 0),
      })),
    }));

    let predictions = [];
    let insights;
    let aiPowered = true;

    try {
      const prompt = `You are a predictive maintenance AI for commercial laundry equipment. Analyze these machines and predict needs.
${JSON.stringify(machineData, null, 2)}
Respond ONLY with JSON: {"predictions":[{"machineNumber":"W001","priority":"CRITICAL|HIGH|MEDIUM|LOW","daysUntilMaintenance":7,"confidence":0.85,"recommendation":"…","reasoning":"…"}],"insights":"…"}`;
      const ai = await callOpenRouter([{ role: 'user', content: prompt }], { maxTokens: 1200 });
      const parsed = parseAIJson(ai);
      predictions = machines.map((machine) => {
        const aiPred = (parsed.predictions || []).find((p) => p.machineNumber === machine.machineNumber) || {};
        return {
          machineId: machine.id,
          machineNumber: machine.machineNumber,
          type: machine.type,
          currentStatus: machine.status,
          totalCycles: machine.totalCycles,
          cyclesSinceLastMaintenance: machine.usages.length,
          priority: aiPred.priority || 'LOW',
          daysUntilMaintenance: aiPred.daysUntilMaintenance || 30,
          recommendedMaintenanceDate: new Date(Date.now() + (aiPred.daysUntilMaintenance || 30) * 86400000).toISOString().split('T')[0],
          recommendation: aiPred.recommendation || 'Operating normally',
          reasoning: aiPred.reasoning,
          confidence: aiPred.confidence || 0.75,
        };
      });
      insights = parsed.insights;
    } catch (e) {
      aiPowered = false;
      predictions = machines.map((machine) => {
        const cycles = machine.usages.length;
        const score = cycles / 500;
        let priority = 'LOW', days = 30;
        if (score > 0.9) { priority = 'CRITICAL'; days = 1; }
        else if (score > 0.7) { priority = 'HIGH'; days = 7; }
        else if (score > 0.5) { priority = 'MEDIUM'; days = 14; }
        return {
          machineId: machine.id,
          machineNumber: machine.machineNumber,
          type: machine.type,
          currentStatus: machine.status,
          totalCycles: machine.totalCycles,
          cyclesSinceLastMaintenance: cycles,
          maintenanceScore: parseFloat(score.toFixed(2)),
          priority,
          recommendedMaintenanceDate: new Date(Date.now() + days * 86400000).toISOString().split('T')[0],
          recommendation: score > 0.7 ? 'Schedule maintenance soon' : 'Operating normally',
        };
      });
    }

    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    predictions.sort((a, b) => order[a.priority] - order[b.priority]);

    await persistAIResult(prisma, {
      feature: 'predict-maintenance', model: DEFAULT_MODEL, userId: req.user?.id,
      input: {}, output: { predictions, insights }, success: aiPowered, latencyMs: Date.now() - t0,
    });

    res.json({
      predictions, insights,
      summary: {
        criticalCount: predictions.filter((p) => p.priority === 'CRITICAL').length,
        highCount: predictions.filter((p) => p.priority === 'HIGH').length,
        mediumCount: predictions.filter((p) => p.priority === 'MEDIUM').length,
        lowCount: predictions.filter((p) => p.priority === 'LOW').length,
      },
      aiPowered,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Reactivation targets — paginated & instrumented
// ============================================================================
router.get('/reactivation-targets', authenticateToken, async (req, res) => {
  const t0 = Date.now();
  try {
    const { inactiveDays = 30, limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(inactiveDays));

    const inactive = await prisma.customer.findMany({
      where: { isActive: true, orders: { every: { createdAt: { lt: cutoff } } } },
      include: { orders: { orderBy: { createdAt: 'desc' }, take: 10 } },
      take: parseInt(limit),
      skip,
    });

    const customerData = inactive.map((c) => {
      const lastOrder = c.orders[0];
      const totalSpent = c.orders.reduce((s, o) => s + parseFloat(o.total), 0);
      const avg = c.orders.length ? totalSpent / c.orders.length : 0;
      return {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        lastOrderDate: lastOrder?.createdAt,
        daysSinceLastOrder: lastOrder ? Math.floor((Date.now() - new Date(lastOrder.createdAt)) / 86400000) : null,
        totalOrders: c.orders.length,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        avgOrderValue: parseFloat(avg.toFixed(2)),
        loyaltyPoints: c.loyaltyPoints,
      };
    });

    let targets = [];
    let insights;
    let aiPowered = true;
    try {
      const prompt = `You are a customer reactivation AI for a laundry service.
${JSON.stringify(customerData.slice(0, 20), null, 2)}
Respond ONLY with JSON: {"targets":[{"customerId":"uuid","reactivationScore":85,"priority":"HIGH|MEDIUM|LOW","suggestedOffer":"…","campaignMessage":"…","reasoning":"…","estimatedConversionRate":0.45}],"insights":"…"}`;
      const ai = await callOpenRouter([{ role: 'user', content: prompt }], { maxTokens: 1300 });
      const parsed = parseAIJson(ai);
      insights = parsed.insights;
      targets = customerData.map((c) => {
        const t = (parsed.targets || []).find((x) => x.customerId === c.id) || {};
        return {
          ...c,
          phone: inactive.find((i) => i.id === c.id)?.phone,
          reactivationScore: t.reactivationScore || 50,
          priority: t.priority || 'LOW',
          suggestedOffer: t.suggestedOffer || '15% off next order',
          campaignMessage: t.campaignMessage,
          reasoning: t.reasoning,
          estimatedConversionRate: t.estimatedConversionRate || 0.25,
        };
      });
    } catch (e) {
      aiPowered = false;
      targets = customerData.map((c) => {
        let score = 50;
        if (c.avgOrderValue > 50) score += 20;
        if (c.totalOrders > 5) score += 15;
        if (c.daysSinceLastOrder && c.daysSinceLastOrder < 60) score += 15;
        return {
          ...c,
          phone: inactive.find((i) => i.id === c.id)?.phone,
          reactivationScore: Math.min(score, 100),
          suggestedOffer: score > 70 ? '20% off next order' : score > 50 ? 'Free pickup & delivery' : '15% off first item',
        };
      });
    }
    targets.sort((a, b) => b.reactivationScore - a.reactivationScore);

    await persistAIResult(prisma, {
      feature: 'reactivation', model: DEFAULT_MODEL, userId: req.user?.id,
      input: { inactiveDays, limit, page }, output: { targets, insights }, success: aiPowered,
      latencyMs: Date.now() - t0,
    });

    res.json({
      targets, insights,
      summary: {
        totalInactiveCustomers: targets.length,
        highPriority: targets.filter((t) => t.priority === 'HIGH').length,
        mediumPriority: targets.filter((t) => t.priority === 'MEDIUM').length,
        lowPriority: targets.filter((t) => t.priority === 'LOW').length,
      },
      page: parseInt(page),
      aiPowered,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AI Quality Check — vision via OpenRouter when imageBase64 present
// ============================================================================
router.post('/quality-check', authenticateToken, async (req, res) => {
  const t0 = Date.now();
  try {
    const { imageBase64, orderId, orderItemId } = req.body;
    let passed, issues, checksPerformed, confidence, aiPowered;

    if (imageBase64) {
      const prompt = `You are a professional garment quality inspector. Analyze this garment photo and check for:
1. Stains/discoloration  2. Tears/holes/damage  3. Missing buttons/broken zippers/loose threads  4. Pressing quality  5. Color fading
Respond ONLY with JSON:
{"pass":true,"issues":[],"confidence":0.92,"checks":{"stainRemoval":{"passed":true,"note":""},"pressingQuality":{"passed":true,"note":""},"colorConsistency":{"passed":true,"note":""},"buttonZipperCheck":{"passed":true,"note":""},"fabricIntegrity":{"passed":true,"note":""}}}`;

      let imageMediaType = 'image/jpeg';
      let imageData = imageBase64;
      if (imageBase64.startsWith('data:')) {
        const m = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (m) { imageMediaType = m[1]; imageData = m[2]; }
      }
      try {
        const aiResponse = await callOpenRouter(
          [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: imageBase64.startsWith('data:') ? imageBase64 : `data:${imageMediaType};base64,${imageData}`,
                  },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
          { model: DEFAULT_VISION_MODEL, maxTokens: 700, temperature: 0.1 }
        );
        const parsed = parseAIJson(aiResponse);
        passed = parsed.pass === true;
        issues = (parsed.issues || []).map((i) => ({ check: 'Vision Analysis', issue: i }));
        confidence = parsed.confidence || 0.9;
        aiPowered = true;
        const names = {
          stainRemoval: 'Stain Removal', pressingQuality: 'Pressing Quality',
          colorConsistency: 'Color Consistency', buttonZipperCheck: 'Button/Zipper Check',
          fabricIntegrity: 'Fabric Integrity',
        };
        checksPerformed = Object.entries(parsed.checks || {}).map(([k, v]) => ({
          name: names[k] || k, passed: v.passed, note: v.note || '',
        }));
        if (checksPerformed.length > 0) {
          checksPerformed.forEach((c) => {
            if (!c.passed && c.note && !issues.find((i) => i.issue === c.note)) {
              issues.push({ check: c.name, issue: c.note });
            }
          });
        }
      } catch (e) {
        console.warn(`⚠️  Vision API failed: ${e.message}`);
        aiPowered = false;
        checksPerformed = null;
      }
    }

    if (!checksPerformed) {
      checksPerformed = [
        { name: 'Stain Removal', passed: true, note: 'No image provided — assumed clean' },
        { name: 'Pressing Quality', passed: true, note: '' },
        { name: 'Color Consistency', passed: true, note: '' },
        { name: 'Button/Zipper Check', passed: true, note: '' },
        { name: 'Fabric Integrity', passed: true, note: '' },
      ];
      issues = [];
      passed = true;
      confidence = 0.7;
      aiPowered = false;
    }

    const overallScore = checksPerformed.length
      ? Math.round((checksPerformed.filter((c) => c.passed).length / checksPerformed.length) * 100)
      : (passed ? 100 : 0);

    await persistAIResult(prisma, {
      feature: 'quality-check', model: DEFAULT_VISION_MODEL, userId: req.user?.id,
      input: { orderId, orderItemId, hasImage: !!imageBase64 },
      output: { passed, overallScore, checksPerformed, issues, confidence },
      success: aiPowered, latencyMs: Date.now() - t0,
    });

    res.json({
      orderId, orderItemId, passed, overallScore,
      confidence: parseFloat((confidence || 0.9).toFixed(2)),
      checksPerformed: checksPerformed.map((c) => ({ name: c.name, passed: c.passed })),
      issues, recommendation: passed ? 'Ready for delivery' : 'Requires re-processing',
      aiPowered: aiPowered !== false,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// NEW FEATURE 1: Subscription churn predictor — auto-coupon trigger
// ============================================================================
router.post('/churn-score', authenticateToken, async (req, res) => {
  const t0 = Date.now();
  try {
    const { autoCoupon = false } = req.body || {};

    const subs = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: {
        customer: {
          include: {
            orders: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
        },
      },
      take: 200,
    });

    const scored = [];
    for (const sub of subs) {
      const orders = sub.customer?.orders || [];
      const lastOrderDate = orders[0]?.createdAt;
      const daysSince = lastOrderDate ? Math.floor((Date.now() - new Date(lastOrderDate)) / 86400000) : 365;
      const usageDelta = orders.length === 0 ? 1.0 : (daysSince > 30 ? Math.min(1.0, daysSince / 60) : 0.2);
      const score = Math.min(1.0, usageDelta);

      let riskLevel = 'low';
      if (score > 0.7) riskLevel = 'high';
      else if (score > 0.4) riskLevel = 'medium';

      const factors = {
        daysSinceLastOrder: daysSince,
        recentOrderCount: orders.length,
        usageDelta,
      };

      let couponSent = false;
      let couponId = null;
      if (autoCoupon && riskLevel === 'high') {
        try {
          const code = `WIN${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          const coupon = await prisma.coupon.create({
            data: {
              code,
              description: `Win-back: ${sub.customer.firstName}`,
              discountType: 'PERCENTAGE',
              discountValue: 25,
              usageLimit: 1,
              usageCount: 0,
              isActive: true,
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 86400000),
            },
          });
          couponSent = true;
          couponId = coupon.id;
        } catch (e) {
          console.warn('coupon create failed:', e.message);
        }
      }

      const upsert = await prisma.churnScore.upsert({
        where: { customerId: sub.customer.id },
        create: {
          customerId: sub.customer.id,
          score, riskLevel, factors, couponSent, couponId,
        },
        update: { score, riskLevel, factors, couponSent: couponSent || undefined, couponId: couponId || undefined, computedAt: new Date() },
      });

      scored.push({
        customerId: sub.customer.id,
        name: `${sub.customer.firstName} ${sub.customer.lastName}`,
        score, riskLevel, factors, couponSent, couponId,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    await persistAIResult(prisma, {
      feature: 'churn-score', model: 'rule-based', userId: req.user?.id,
      input: { autoCoupon }, output: { count: scored.length }, success: true,
      latencyMs: Date.now() - t0,
    });

    res.json({
      scored,
      summary: {
        total: scored.length,
        high: scored.filter((s) => s.riskLevel === 'high').length,
        medium: scored.filter((s) => s.riskLevel === 'medium').length,
        low: scored.filter((s) => s.riskLevel === 'low').length,
        couponsSent: scored.filter((s) => s.couponSent).length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List churn scores (paginated)
router.get('/churn-scores', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, riskLevel } = req.query;
    const skip = (page - 1) * limit;
    const where = riskLevel ? { riskLevel } : {};
    const [scores, total] = await Promise.all([
      prisma.churnScore.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { score: 'desc' },
      }),
      prisma.churnScore.count({ where }),
    ]);
    res.json({ scores, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// NEW FEATURE 2: Garment lifecycle (QR/RFID provenance)
// ============================================================================
router.post('/garment-event', authenticateToken, async (req, res) => {
  try {
    const { garmentId, orderId, eventType, notes, metadata } = req.body || {};
    if (!garmentId || !eventType) {
      return res.status(400).json({ error: 'garmentId and eventType required' });
    }
    const event = await prisma.garmentLifecycleEvent.create({
      data: {
        garmentId, orderId, eventType,
        staffId: req.user?.id,
        notes, metadata: metadata || {},
      },
    });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/garment/:id/lifecycle', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    const where = { garmentId: req.params.id };
    const [events, total] = await Promise.all([
      prisma.garmentLifecycleEvent.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.garmentLifecycleEvent.count({ where }),
    ]);
    res.json({ events, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// NEW FEATURE 3: WhatsApp two-way concierge (Twilio webhook)
// ============================================================================
router.post('/whatsapp/inbound', async (req, res) => {
  const t0 = Date.now();
  try {
    const From = req.body.From || req.body.from || '';
    const Body = req.body.Body || req.body.body || '';
    const phoneNumber = String(From).replace(/^whatsapp:/i, '');

    if (!Body || !phoneNumber) {
      return res.status(400).type('text/xml').send('<Response></Response>');
    }

    let customer = null;
    try {
      customer = await prisma.customer.findFirst({ where: { phone: phoneNumber } });
    } catch (_) {}

    await prisma.whatsAppConversation.create({
      data: {
        customerId: customer?.id, phoneNumber, direction: 'inbound', message: Body,
      },
    });

    const recentTurns = await prisma.whatsAppConversation.findMany({
      where: { phoneNumber }, orderBy: { createdAt: 'desc' }, take: 10,
    });
    const history = recentTurns
      .reverse()
      .map((m) => ({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: m.message }));

    const messages = [
      {
        role: 'system',
        content:
          'You are a WhatsApp concierge for Laundry Services. Help with pickups, status, pricing. Reply in <= 200 chars. End with the next clear action.',
      },
      ...history,
    ];

    let aiText = 'Sorry, I had trouble processing that. Please text PICKUP, STATUS, or HELP.';
    let aiPowered = true;
    try {
      aiText = await callOpenRouter(messages, { maxTokens: 200 });
    } catch (e) {
      aiPowered = false;
    }

    await prisma.whatsAppConversation.create({
      data: {
        customerId: customer?.id, phoneNumber, direction: 'outbound', message: aiText, aiResponse: aiPowered,
      },
    });

    await persistAIResult(prisma, {
      feature: 'whatsapp', model: DEFAULT_MODEL, userId: customer?.id,
      input: { phoneNumber, message: Body }, output: { reply: aiText },
      success: aiPowered, latencyMs: Date.now() - t0,
    });

    // Twilio expects TwiML
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${aiText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</Message></Response>`;
    res.type('text/xml').send(xml);
  } catch (error) {
    res.status(500).type('text/xml').send('<Response><Message>Error processing your request.</Message></Response>');
  }
});

router.get('/whatsapp/conversations', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, phone } = req.query;
    const skip = (page - 1) * limit;
    const where = phone ? { phoneNumber: phone } : {};
    const [conversations, total] = await Promise.all([
      prisma.whatsAppConversation.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.whatsAppConversation.count({ where }),
    ]);
    res.json({ conversations, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AI Audit log — paginated
// ============================================================================
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, feature, success } = req.query;
    const skip = (page - 1) * limit;
    const where = {};
    if (feature) where.feature = feature;
    if (success !== undefined) where.success = success === 'true';

    const [results, total] = await Promise.all([
      prisma.aIResult.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.aIResult.count({ where }),
    ]);

    res.json({ results, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit-driven addition: "Subscription optimization agent (recommend frequency/add-ons based on usage)".
router.post('/subscription-optimize', authenticateToken, async (req, res) => {
  const t0 = Date.now();
  try {
    const { customerId } = req.body || {};
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } }).catch(() => null);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const orders = await prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }).catch(() => []);

    let subscription = null;
    try {
      subscription = await prisma.subscription.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (_) {
      subscription = null;
    }

    const systemPrompt = `You are a subscription-optimization agent for a laundry/dry-cleaning service. Recommend pickup frequency, plan tier, and add-ons (e.g. shirt-press, bedding, stain treatment) given the customer\'s usage pattern. Respond with strict JSON only of the form: {"recommended_frequency": "weekly|biweekly|monthly|on_demand", "recommended_plan": <string>, "recommended_add_ons": [<strings>], "expected_savings_per_month": <number>, "expected_revenue_lift_per_month": <number>, "rationale": <string>, "warnings": [<strings>]}. No prose outside JSON.`;
    const userMessage = `Customer:\n${JSON.stringify(customer, null, 2)}\n\nCurrent subscription:\n${JSON.stringify(subscription, null, 2)}\n\nRecent orders:\n${JSON.stringify(orders.slice(0, 30), null, 2)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    const aiResponse = await callOpenRouter(messages, { model: DEFAULT_MODEL, maxTokens: 1200 });

    let parsed;
    let parseSuccess = false;
    try {
      parsed = parseAIJson(aiResponse);
      parseSuccess = true;
    } catch (_) {
      parsed = { raw: aiResponse };
    }

    try {
      await persistAIResult(prisma, {
        userId: req.user?.id || null,
        feature: 'subscription-optimize',
        input: { customerId },
        output: parsed,
        success: parseSuccess,
        latencyMs: Date.now() - t0,
      });
    } catch (_) {
      // best effort
    }

    res.json({ customerId, recommendation: parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
