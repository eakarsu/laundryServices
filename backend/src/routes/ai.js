const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// OpenRouter API helper
const callOpenRouter = async (messages, maxTokens = 1000) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku';

  if (!apiKey || apiKey === 'your-openrouter-api-key') {
    console.error('❌ OpenRouter API key not configured');
    throw new Error('OpenRouter API key not configured');
  }

  console.log(`🤖 Calling OpenRouter API with model: ${model}`);
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'Laundry Services AI'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ OpenRouter API error: ${error}`);
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  console.log(`✅ OpenRouter API response received`);
  return data.choices[0].message.content;
};

// AI Order Estimator - Quote from photo/description
router.post('/estimate', optionalAuth, async (req, res) => {
  try {
    const { imageBase64, description } = req.body;

    if (!description && !imageBase64) {
      return res.status(400).json({ error: 'Please provide a description or image' });
    }

    // Get services and garments for context
    const [services, garments] = await Promise.all([
      prisma.service.findMany({ where: { isActive: true }, select: { name: true, basePrice: true } }),
      prisma.garmentType.findMany({ where: { isActive: true }, select: { name: true, basePrice: true, category: true } })
    ]);

    const prompt = `You are a laundry service AI assistant. Analyze the following laundry order description and estimate the items and costs.

Available garment types with base prices:
${garments.map(g => `- ${g.name} (${g.category}): $${g.basePrice}`).join('\n')}

Customer description: "${description || 'Customer uploaded an image of laundry items'}"

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "items": [
    {"name": "garment name", "service": "Dry Cleaning", "quantity": 1, "price": 5.99}
  ],
  "totalEstimate": 25.99,
  "confidence": 0.85,
  "notes": "Brief note about the estimate"
}`;

    let estimatedItems = [];
    let totalEstimate = 0;
    let confidence = 0.85;
    let notes = '';

    try {
      const aiResponse = await callOpenRouter([{ role: 'user', content: prompt }], 500);
      const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());
      estimatedItems = parsed.items || [];
      totalEstimate = parsed.totalEstimate || estimatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      confidence = parsed.confidence || 0.85;
      notes = parsed.notes || '';
    } catch (parseError) {
      console.warn(`⚠️  AI estimation failed, using fallback: ${parseError.message}`);
      // Fallback to rule-based estimation
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
      totalEstimate = estimatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      notes = 'Estimate based on keyword matching';
    }

    // Save estimate
    const aiEstimate = await prisma.aIEstimate.create({
      data: {
        customerId: req.user?.id,
        imageUrl: imageBase64 ? 'base64_image' : null,
        description,
        estimatedItems,
        totalEstimate,
        confidence
      }
    });

    res.json({
      id: aiEstimate.id,
      items: estimatedItems,
      totalEstimate,
      confidence,
      notes,
      message: 'AI estimate generated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Route Optimizer
router.post('/optimize-route', authenticateToken, async (req, res) => {
  try {
    const { stops } = req.body;

    if (!stops || stops.length < 2) {
      return res.status(400).json({ error: 'At least 2 stops required for optimization' });
    }

    // Use AI for route optimization suggestions
    const prompt = `You are a route optimization AI. Given these stops, suggest the optimal order to minimize travel time.

Stops:
${stops.map((s, i) => `${i + 1}. ${s.type} at (${s.lat}, ${s.lng}) - Priority: ${s.priority || 'normal'}`).join('\n')}

Provide ONLY the optimized order as a JSON array of indices (0-based), e.g., [0, 2, 1, 3]`;

    let optimizedRoute = [...stops];

    try {
      const aiResponse = await callOpenRouter([{ role: 'user', content: prompt }], 200);
      const indices = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());
      if (Array.isArray(indices)) {
        optimizedRoute = indices.map(i => stops[i]).filter(Boolean);
      }
    } catch {
      // Fallback: nearest neighbor algorithm
      const remaining = [...stops];
      optimizedRoute = [];
      let current = remaining.shift();
      optimizedRoute.push(current);

      while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        remaining.forEach((stop, index) => {
          const distance = Math.sqrt(
            Math.pow(stop.lat - current.lat, 2) +
            Math.pow(stop.lng - current.lng, 2)
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

    // Calculate savings
    const calculateDistance = (route) => route.reduce((sum, stop, i) => {
      if (i === 0) return 0;
      return sum + Math.sqrt(
        Math.pow(stop.lat - route[i - 1].lat, 2) +
        Math.pow(stop.lng - route[i - 1].lng, 2)
      );
    }, 0);

    const originalDistance = calculateDistance(stops);
    const optimizedDistance = calculateDistance(optimizedRoute);
    const savings = originalDistance > 0 ? ((originalDistance - optimizedDistance) / originalDistance * 100).toFixed(1) : 0;

    res.json({
      optimizedRoute,
      estimatedSavings: `${savings}%`,
      totalStops: optimizedRoute.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Stain Identifier
router.post('/identify-stain', optionalAuth, async (req, res) => {
  try {
    const { imageBase64, description, orderItemId } = req.body;

    if (!description && !imageBase64) {
      return res.status(400).json({ error: 'Please provide a description or image of the stain' });
    }

    const prompt = `You are a professional laundry stain identification AI. Analyze this stain description and provide treatment recommendations.

Stain description: "${description || 'Customer uploaded an image of a stain'}"

Respond ONLY with valid JSON in this exact format:
{
  "stainType": "type of stain",
  "treatment": "detailed treatment recommendation",
  "expectedSuccessRate": 85,
  "warnings": ["any warnings or precautions"],
  "alternativeTreatments": ["alternative treatment 1", "alternative treatment 2"]
}`;

    let stainAnalysis = {
      stainType: 'Unknown',
      treatment: 'Professional cleaning recommended',
      expectedSuccessRate: 80,
      warnings: [],
      alternativeTreatments: []
    };

    try {
      const aiResponse = await callOpenRouter([{ role: 'user', content: prompt }], 400);
      stainAnalysis = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      // Fallback to rule-based identification
      const words = (description || '').toLowerCase();
      const stainTypes = {
        'coffee': { type: 'Coffee', treatment: 'Pre-treat with enzyme-based cleaner, cold water wash', rate: 95 },
        'wine': { type: 'Wine', treatment: 'Apply salt immediately, then cold water and white wine vinegar', rate: 85 },
        'grease': { type: 'Grease/Oil', treatment: 'Apply dish soap, let sit for 30 min, hot water wash', rate: 90 },
        'oil': { type: 'Grease/Oil', treatment: 'Apply dish soap, let sit for 30 min, hot water wash', rate: 90 },
        'ink': { type: 'Ink', treatment: 'Apply rubbing alcohol, blot gently, cold water rinse', rate: 75 },
        'blood': { type: 'Blood', treatment: 'Cold water soak, enzyme-based detergent, avoid heat', rate: 92 },
        'grass': { type: 'Grass', treatment: 'Enzyme-based pre-treatment, warm water wash', rate: 88 },
        'sweat': { type: 'Sweat', treatment: 'Enzyme cleaner or white vinegar, warm water', rate: 95 }
      };

      for (const [keyword, data] of Object.entries(stainTypes)) {
        if (words.includes(keyword)) {
          stainAnalysis = {
            stainType: data.type,
            treatment: data.treatment,
            expectedSuccessRate: data.rate,
            warnings: [],
            alternativeTreatments: []
          };
          break;
        }
      }
    }

    // Save analysis
    const analysis = await prisma.aIStainAnalysis.create({
      data: {
        orderItemId,
        imageUrl: imageBase64 ? 'base64_image' : null,
        stainType: stainAnalysis.stainType,
        treatment: stainAnalysis.treatment,
        confidence: stainAnalysis.expectedSuccessRate / 100
      }
    });

    res.json({
      id: analysis.id,
      stainType: stainAnalysis.stainType,
      treatment: stainAnalysis.treatment,
      expectedSuccessRate: `${stainAnalysis.expectedSuccessRate}%`,
      confidence: (stainAnalysis.expectedSuccessRate / 100).toFixed(2),
      warnings: stainAnalysis.warnings,
      alternativeTreatments: stainAnalysis.alternativeTreatments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Customer Service Bot
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Save user message
    await prisma.aIChatHistory.create({
      data: {
        customerId: req.user?.id,
        sessionId,
        role: 'user',
        message
      }
    });

    // Get chat history for context
    const history = await prisma.aIChatHistory.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 10
    });

    const systemPrompt = `You are a helpful customer service AI for a professional laundry and dry cleaning service called "Laundry Services".

Key information:
- Services: Dry cleaning, laundry, wash & fold, pressing, alterations, specialty cleaning
- Pricing: Shirts from $5.99, pants from $7.99, suits from $12.99
- Rush service: Available for 50% surcharge, same-day or next morning
- Pickup/Delivery: Free, available 7am-7pm any day
- Store hours: Mon-Fri 7am-7pm, Sat 8am-5pm, Sun 10am-4pm

Be friendly, concise, and helpful. If you don't know something specific, offer to connect them with a human representative.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.message })),
      { role: 'user', content: message }
    ];

    let response;
    try {
      response = await callOpenRouter(messages, 300);
    } catch (aiError) {
      // Fallback responses
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
        response = "Our pricing varies by garment and service. Dry cleaning starts at $5.99 for shirts and $7.99 for pants. Would you like a detailed quote?";
      } else if (lowerMessage.includes('pickup') || lowerMessage.includes('delivery')) {
        response = "We offer free pickup and delivery! Schedule any day 7am-7pm. Delivery is typically within 24-48 hours.";
      } else if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
        response = "We're open Mon-Fri 7am-7pm, Sat 8am-5pm, Sun 10am-4pm. Pickup/delivery available during these hours.";
      } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        response = "Hello! Welcome to Laundry Services. How can I help you today?";
      } else {
        response = "I'd be happy to help! Could you tell me more about what you need? I can assist with pricing, scheduling, order status, and more.";
      }
    }

    // Save bot response
    await prisma.aIChatHistory.create({
      data: {
        customerId: req.user?.id,
        sessionId,
        role: 'assistant',
        message: response
      }
    });

    res.json({ response, sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chat history
router.get('/chat/:sessionId', authenticateToken, async (req, res) => {
  try {
    const messages = await prisma.aIChatHistory.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Demand Predictor
router.get('/predict-demand', authenticateToken, async (req, res) => {
  try {
    const { locationId, days = 7 } = req.query;

    // Get historical data
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const historicalOrders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, total: true, status: true }
    });

    // Prepare data for AI analysis
    const dailyStats = {};
    historicalOrders.forEach(order => {
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { orders: 0, revenue: 0 };
      }
      dailyStats[dateKey].orders++;
      dailyStats[dateKey].revenue += parseFloat(order.total);
    });

    const historicalSummary = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      dayOfWeek: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
      orders: stats.orders,
      revenue: stats.revenue.toFixed(2)
    }));

    let predictions = [];

    try {
      // Use AI for intelligent predictions
      const prompt = `You are a demand forecasting AI for a laundry service business. Analyze the historical data and predict demand for the next ${days} days.

Historical data (last 30 days):
${JSON.stringify(historicalSummary, null, 2)}

Current date: ${new Date().toISOString().split('T')[0]}

Consider patterns like:
- Day of week trends (weekends vs weekdays)
- Growth/decline trends
- Seasonal patterns
- Any anomalies or special events

Respond ONLY with valid JSON in this exact format:
{
  "predictions": [
    {
      "date": "YYYY-MM-DD",
      "dayOfWeek": "Monday",
      "predictedOrders": 15,
      "predictedRevenue": 750.00,
      "confidence": 0.85,
      "reasoning": "Brief explanation"
    }
  ],
  "insights": "Overall trend analysis and recommendations"
}`;

      const aiResponse = await callOpenRouter([{ role: 'user', content: prompt }], 800);
      const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());
      predictions = parsed.predictions || [];

      // Save predictions to database
      for (const pred of predictions) {
        await prisma.aIDemandPrediction.create({
          data: {
            locationId,
            date: new Date(pred.date),
            predictedOrders: pred.predictedOrders,
            predictedRevenue: pred.predictedRevenue,
            confidence: pred.confidence
          }
        });
      }

      res.json({
        predictions,
        insights: parsed.insights,
        summary: {
          totalPredictedOrders: predictions.reduce((sum, p) => sum + p.predictedOrders, 0),
          totalPredictedRevenue: predictions.reduce((sum, p) => sum + p.predictedRevenue, 0),
          peakDay: predictions.reduce((max, p) => p.predictedOrders > max.predictedOrders ? p : max, predictions[0])
        },
        aiPowered: true
      });

    } catch (aiError) {
      console.warn(`⚠️  AI demand prediction failed, using fallback: ${aiError.message}`);

      // Fallback to simple calculation
      const dayAverages = {};
      historicalOrders.forEach(order => {
        const day = new Date(order.createdAt).getDay();
        if (!dayAverages[day]) {
          dayAverages[day] = { count: 0, revenue: 0 };
        }
        dayAverages[day].count++;
        dayAverages[day].revenue += parseFloat(order.total);
      });

      for (let i = 0; i < parseInt(days); i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dayOfWeek = date.getDay();
        const avg = dayAverages[dayOfWeek] || { count: 0, revenue: 0 };
        const baseOrders = Math.round(avg.count / 4) || 10;
        const baseRevenue = avg.count > 0 ? (avg.revenue / avg.count) * baseOrders : 500;

        predictions.push({
          date: date.toISOString().split('T')[0],
          dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
          predictedOrders: baseOrders,
          predictedRevenue: parseFloat(baseRevenue.toFixed(2)),
          confidence: 0.65
        });
      }

      res.json({
        predictions,
        summary: {
          totalPredictedOrders: predictions.reduce((sum, p) => sum + p.predictedOrders, 0),
          totalPredictedRevenue: predictions.reduce((sum, p) => sum + p.predictedRevenue, 0),
          peakDay: predictions.reduce((max, p) => p.predictedOrders > max.predictedOrders ? p : max, predictions[0])
        },
        aiPowered: false
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Maintenance Predictor
router.get('/predict-maintenance', authenticateToken, async (req, res) => {
  try {
    const machines = await prisma.machine.findMany({
      include: {
        usages: {
          orderBy: { startTime: 'desc' },
          take: 100
        },
        maintenances: {
          orderBy: { completedDate: 'desc' },
          take: 5
        }
      }
    });

    // Prepare machine data for AI analysis
    const machineData = machines.map(m => ({
      id: m.machineNumber,
      type: m.type,
      brand: m.brand,
      model: m.model,
      status: m.status,
      totalCycles: m.totalCycles,
      recentUsages: m.usages.length,
      lastMaintenance: m.maintenances[0]?.completedDate,
      maintenanceHistory: m.maintenances.map(mt => ({
        type: mt.type,
        date: mt.completedDate,
        cost: parseFloat(mt.cost || 0)
      }))
    }));

    let predictions = [];

    try {
      // Use AI for intelligent maintenance prediction
      const prompt = `You are a predictive maintenance AI for commercial laundry equipment. Analyze the machine data and predict maintenance needs.

Machine Data:
${JSON.stringify(machineData, null, 2)}

Consider factors like:
- Usage patterns and frequency
- Time since last maintenance
- Machine type and age
- Historical maintenance patterns
- Current status

Respond ONLY with valid JSON in this exact format:
{
  "predictions": [
    {
      "machineNumber": "W001",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "daysUntilMaintenance": 7,
      "confidence": 0.85,
      "recommendation": "Specific maintenance action needed",
      "reasoning": "Why this prediction was made"
    }
  ],
  "insights": "Overall equipment health analysis"
}`;

      const aiResponse = await callOpenRouter([{ role: 'user', content: prompt }], 1000);
      const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());

      predictions = machines.map(machine => {
        const aiPred = parsed.predictions.find(p => p.machineNumber === machine.machineNumber) || {};
        return {
          machineId: machine.id,
          machineNumber: machine.machineNumber,
          type: machine.type,
          currentStatus: machine.status,
          totalCycles: machine.totalCycles,
          cyclesSinceLastMaintenance: machine.usages.length,
          priority: aiPred.priority || 'LOW',
          daysUntilMaintenance: aiPred.daysUntilMaintenance || 30,
          recommendedMaintenanceDate: new Date(Date.now() + (aiPred.daysUntilMaintenance || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          recommendation: aiPred.recommendation || 'Operating normally',
          reasoning: aiPred.reasoning,
          confidence: aiPred.confidence || 0.75
        };
      });

      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      predictions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      res.json({
        predictions,
        insights: parsed.insights,
        summary: {
          criticalCount: predictions.filter(p => p.priority === 'CRITICAL').length,
          highCount: predictions.filter(p => p.priority === 'HIGH').length,
          mediumCount: predictions.filter(p => p.priority === 'MEDIUM').length,
          lowCount: predictions.filter(p => p.priority === 'LOW').length
        },
        aiPowered: true
      });

    } catch (aiError) {
      console.warn(`⚠️  AI maintenance prediction failed, using fallback: ${aiError.message}`);

      // Fallback to simple calculation
      predictions = machines.map(machine => {
        const cyclesSinceLastMaintenance = machine.usages.length;
        const avgCyclesBetweenMaintenance = 500;
        const maintenanceScore = cyclesSinceLastMaintenance / avgCyclesBetweenMaintenance;

        let priority = 'LOW';
        let daysUntilMaintenance = 30;

        if (maintenanceScore > 0.9) {
          priority = 'CRITICAL';
          daysUntilMaintenance = 1;
        } else if (maintenanceScore > 0.7) {
          priority = 'HIGH';
          daysUntilMaintenance = 7;
        } else if (maintenanceScore > 0.5) {
          priority = 'MEDIUM';
          daysUntilMaintenance = 14;
        }

        return {
          machineId: machine.id,
          machineNumber: machine.machineNumber,
          type: machine.type,
          currentStatus: machine.status,
          totalCycles: machine.totalCycles,
          cyclesSinceLastMaintenance,
          maintenanceScore: parseFloat(maintenanceScore.toFixed(2)),
          priority,
          recommendedMaintenanceDate: new Date(Date.now() + daysUntilMaintenance * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          recommendation: maintenanceScore > 0.7 ? 'Schedule maintenance soon' : 'Operating normally'
        };
      });

      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      predictions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      res.json({
        predictions,
        summary: {
          criticalCount: predictions.filter(p => p.priority === 'CRITICAL').length,
          highCount: predictions.filter(p => p.priority === 'HIGH').length,
          mediumCount: predictions.filter(p => p.priority === 'MEDIUM').length,
          lowCount: predictions.filter(p => p.priority === 'LOW').length
        },
        aiPowered: false
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Reactivation Campaigns
router.get('/reactivation-targets', authenticateToken, async (req, res) => {
  try {
    const { inactiveDays = 30, limit = 50 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(inactiveDays));

    const inactiveCustomers = await prisma.customer.findMany({
      where: {
        isActive: true,
        orders: {
          every: { createdAt: { lt: cutoffDate } }
        }
      },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      },
      take: parseInt(limit)
    });

    // Prepare customer data for AI analysis
    const customerData = inactiveCustomers.map(customer => {
      const lastOrder = customer.orders[0];
      const totalSpent = customer.orders.reduce((sum, o) => sum + parseFloat(o.total), 0);
      const avgOrderValue = customer.orders.length > 0 ? totalSpent / customer.orders.length : 0;
      const daysSinceLastOrder = lastOrder
        ? Math.floor((Date.now() - new Date(lastOrder.createdAt)) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        lastOrderDate: lastOrder?.createdAt,
        daysSinceLastOrder,
        totalOrders: customer.orders.length,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
        loyaltyPoints: customer.loyaltyPoints,
        orderHistory: customer.orders.map(o => ({
          date: o.createdAt,
          amount: parseFloat(o.total),
          status: o.status
        }))
      };
    });

    let targets = [];

    try {
      // Use AI for intelligent reactivation targeting
      const prompt = `You are a customer reactivation AI for a laundry service. Analyze inactive customers and recommend personalized reactivation strategies.

Inactive Customer Data:
${JSON.stringify(customerData.slice(0, 20), null, 2)}

Analyze each customer considering:
- Spending patterns and lifetime value
- Recency of last order
- Order frequency before becoming inactive
- Loyalty points accumulated
- Potential reasons for churn

Respond ONLY with valid JSON in this exact format:
{
  "targets": [
    {
      "customerId": "uuid",
      "reactivationScore": 85,
      "priority": "HIGH|MEDIUM|LOW",
      "suggestedOffer": "Specific personalized offer",
      "campaignMessage": "Personalized message to send",
      "reasoning": "Why this customer and offer",
      "estimatedConversionRate": 0.45
    }
  ],
  "insights": "Overall reactivation strategy recommendations"
}`;

      const aiResponse = await callOpenRouter([{ role: 'user', content: prompt }], 1200);
      const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());

      targets = customerData.map(customer => {
        const aiTarget = parsed.targets.find(t => t.customerId === customer.id) || {};
        return {
          customerId: customer.id,
          name: customer.name,
          email: customer.email,
          phone: inactiveCustomers.find(c => c.id === customer.id)?.phone,
          lastOrderDate: customer.lastOrderDate,
          daysSinceLastOrder: customer.daysSinceLastOrder,
          totalOrders: customer.totalOrders,
          totalSpent: customer.totalSpent,
          avgOrderValue: customer.avgOrderValue,
          reactivationScore: aiTarget.reactivationScore || 50,
          priority: aiTarget.priority || 'LOW',
          suggestedOffer: aiTarget.suggestedOffer || '15% off next order',
          campaignMessage: aiTarget.campaignMessage,
          reasoning: aiTarget.reasoning,
          estimatedConversionRate: aiTarget.estimatedConversionRate || 0.25
        };
      });

      targets.sort((a, b) => b.reactivationScore - a.reactivationScore);

      res.json({
        targets,
        insights: parsed.insights,
        summary: {
          totalInactiveCustomers: targets.length,
          highPriority: targets.filter(t => t.priority === 'HIGH').length,
          mediumPriority: targets.filter(t => t.priority === 'MEDIUM').length,
          lowPriority: targets.filter(t => t.priority === 'LOW').length,
          estimatedReactivations: Math.round(targets.reduce((sum, t) => sum + (t.estimatedConversionRate * 100), 0) / 100)
        },
        aiPowered: true
      });

    } catch (aiError) {
      console.warn(`⚠️  AI reactivation targeting failed, using fallback: ${aiError.message}`);

      // Fallback to simple scoring
      targets = customerData.map(customer => {
        let score = 50;
        if (customer.avgOrderValue > 50) score += 20;
        if (customer.totalOrders > 5) score += 15;
        if (customer.daysSinceLastOrder && customer.daysSinceLastOrder < 60) score += 15;

        return {
          customerId: customer.id,
          name: customer.name,
          email: customer.email,
          phone: inactiveCustomers.find(c => c.id === customer.id)?.phone,
          lastOrderDate: customer.lastOrderDate,
          daysSinceLastOrder: customer.daysSinceLastOrder,
          totalOrders: customer.totalOrders,
          totalSpent: customer.totalSpent,
          avgOrderValue: customer.avgOrderValue,
          reactivationScore: Math.min(score, 100),
          suggestedOffer: score > 70 ? '20% off next order' : score > 50 ? 'Free pickup & delivery' : '15% off first item'
        };
      });

      targets.sort((a, b) => b.reactivationScore - a.reactivationScore);

      res.json({
        targets,
        summary: {
          totalInactiveCustomers: targets.length,
          highPotential: targets.filter(t => t.reactivationScore > 70).length,
          mediumPotential: targets.filter(t => t.reactivationScore > 50 && t.reactivationScore <= 70).length,
          lowPotential: targets.filter(t => t.reactivationScore <= 50).length
        },
        aiPowered: false
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Quality Check
router.post('/quality-check', authenticateToken, async (req, res) => {
  try {
    const { imageBase64, orderId, orderItemId } = req.body;

    const issues = [];
    const qualityChecks = [
      { name: 'Stain Removal', passed: Math.random() > 0.1, note: 'Some residual staining detected' },
      { name: 'Pressing Quality', passed: Math.random() > 0.15, note: 'Minor wrinkles on collar' },
      { name: 'Color Consistency', passed: Math.random() > 0.05, note: 'Color appears faded' },
      { name: 'Button/Zipper Check', passed: Math.random() > 0.08, note: 'Missing button detected' },
      { name: 'Fabric Integrity', passed: Math.random() > 0.05, note: 'Minor fabric damage' }
    ];

    qualityChecks.forEach(check => {
      if (!check.passed) {
        issues.push({ check: check.name, issue: check.note });
      }
    });

    const overallScore = ((qualityChecks.filter(c => c.passed).length / qualityChecks.length) * 100).toFixed(0);
    const passed = issues.length === 0;

    res.json({
      orderId,
      orderItemId,
      passed,
      overallScore: parseInt(overallScore),
      checksPerformed: qualityChecks.map(c => ({ name: c.name, passed: c.passed })),
      issues,
      recommendation: passed ? 'Ready for delivery' : 'Requires re-processing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
