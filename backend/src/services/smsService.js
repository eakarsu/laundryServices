const twilio = require('twilio');

let twilioClient = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return null;
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
};

const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';

/**
 * Send an SMS message via Twilio.
 * @param {string} to - Destination phone number (E.164 format, e.g. +15551234567)
 * @param {string} message - The SMS message body
 * @returns {Promise<Object>}
 */
const sendOrderSMS = async (to, message) => {
  const client = getTwilioClient();

  if (!client) {
    console.warn('⚠️  Twilio credentials not configured — skipping SMS');
    return { skipped: true };
  }

  if (!FROM_NUMBER) {
    console.warn('⚠️  TWILIO_FROM_NUMBER not configured — skipping SMS');
    return { skipped: true };
  }

  // Normalize the phone number to E.164 format if it doesn't already start with +
  let toNumber = to;
  if (to && !to.startsWith('+')) {
    toNumber = `+1${to.replace(/\D/g, '')}`;
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: FROM_NUMBER,
      to: toNumber
    });

    console.log(`📱 SMS sent to ${toNumber}: SID=${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`❌ Failed to send SMS to ${toNumber}:`, error.message);
    throw error;
  }
};

/**
 * Send an order status SMS notification.
 * @param {string} to - Customer phone number
 * @param {string} orderStatus - OrderStatus enum value
 * @param {Object} orderDetails - { orderNumber }
 */
const sendOrderStatusSMS = async (to, orderStatus, orderDetails) => {
  const messageMap = {
    PENDING: `Laundry Services: Your order ${orderDetails.orderNumber} has been received! We'll pick it up soon.`,
    PICKED_UP: `Laundry Services: We've picked up your order ${orderDetails.orderNumber}. Processing begins shortly!`,
    PROCESSING: `Laundry Services: Order ${orderDetails.orderNumber} is now being processed at our facility.`,
    CLEANING: `Laundry Services: Your items in order ${orderDetails.orderNumber} are being cleaned.`,
    PRESSING: `Laundry Services: Your items in order ${orderDetails.orderNumber} are being pressed.`,
    QUALITY_CHECK: `Laundry Services: Order ${orderDetails.orderNumber} is undergoing quality check.`,
    READY: `Laundry Services: Great news! Order ${orderDetails.orderNumber} is ready. We'll deliver it soon!`,
    OUT_FOR_DELIVERY: `Laundry Services: Order ${orderDetails.orderNumber} is out for delivery. Expect it shortly!`,
    DELIVERED: `Laundry Services: Order ${orderDetails.orderNumber} has been delivered. Thank you for using our service!`,
    COMPLETED: `Laundry Services: Order ${orderDetails.orderNumber} is complete. Thank you!`,
    CANCELLED: `Laundry Services: Order ${orderDetails.orderNumber} has been cancelled. Contact us if you have questions.`
  };

  const message = messageMap[orderStatus] || `Laundry Services: Your order ${orderDetails.orderNumber} status has been updated to ${orderStatus.replace(/_/g, ' ')}.`;

  return sendOrderSMS(to, message);
};

module.exports = { sendOrderSMS, sendOrderStatusSMS };
