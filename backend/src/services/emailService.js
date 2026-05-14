const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@laundryservices.com';
const FROM_NAME = 'Laundry Services';

const STATUS_SUBJECT_MAP = {
  PENDING: 'Order Received',
  PICKED_UP: 'Your Items Have Been Picked Up',
  PROCESSING: 'Your Order Is Being Processed',
  CLEANING: 'Your Items Are Being Cleaned',
  PRESSING: 'Your Items Are Being Pressed',
  QUALITY_CHECK: 'Your Order Is Undergoing Quality Check',
  READY: 'Your Order Is Ready!',
  OUT_FOR_DELIVERY: 'Your Order Is On Its Way',
  DELIVERED: 'Your Order Has Been Delivered',
  COMPLETED: 'Order Complete — Thank You!',
  CANCELLED: 'Your Order Has Been Cancelled'
};

const STATUS_MESSAGE_MAP = {
  PENDING: 'We have received your order and it is being prepared for pickup.',
  PICKED_UP: 'Great news! We have picked up your laundry and it is on its way to our facility.',
  PROCESSING: 'Your order is now being processed at our facility.',
  CLEANING: 'Your items are currently being cleaned with care.',
  PRESSING: 'Your items are being pressed to perfection.',
  QUALITY_CHECK: 'Your order is undergoing our thorough quality inspection.',
  READY: 'Your order is clean, pressed, and ready! We will arrange delivery soon.',
  OUT_FOR_DELIVERY: 'Your order is out for delivery and will arrive shortly.',
  DELIVERED: 'Your order has been successfully delivered. We hope you love the results!',
  COMPLETED: 'Your order is complete. Thank you for choosing Laundry Services!',
  CANCELLED: 'Your order has been cancelled. If you have questions, please contact us.'
};

/**
 * Send a transactional email when an order status changes.
 * @param {string} to - Customer email address
 * @param {string} orderStatus - One of the OrderStatus enum values
 * @param {Object} orderDetails - { orderNumber, customerName, total, estimatedReady }
 */
const sendOrderStatusEmail = async (to, orderStatus, orderDetails) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('⚠️  SENDGRID_API_KEY not configured — skipping email');
    return { skipped: true };
  }

  const subject = `[Laundry Services] ${STATUS_SUBJECT_MAP[orderStatus] || 'Order Update'} — ${orderDetails.orderNumber}`;
  const statusMessage = STATUS_MESSAGE_MAP[orderStatus] || 'Your order status has been updated.';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a73e8; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Laundry Services</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <p style="font-size: 16px; color: #333;">Hi ${orderDetails.customerName || 'Valued Customer'},</p>
        <p style="font-size: 16px; color: #333;">${statusMessage}</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Order Number:</strong> ${orderDetails.orderNumber}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> ${orderStatus.replace(/_/g, ' ')}</p>
          ${orderDetails.total ? `<p style="margin: 5px 0;"><strong>Total:</strong> $${parseFloat(orderDetails.total).toFixed(2)}</p>` : ''}
          ${orderDetails.estimatedReady ? `<p style="margin: 5px 0;"><strong>Estimated Ready:</strong> ${new Date(orderDetails.estimatedReady).toLocaleDateString()}</p>` : ''}
        </div>
        <p style="color: #666; font-size: 14px;">If you have any questions, please don't hesitate to contact us.</p>
        <p style="color: #666; font-size: 14px;">Thank you for choosing Laundry Services!</p>
      </div>
      <div style="background: #f5f5f5; padding: 15px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Laundry Services. All rights reserved.</p>
      </div>
    </div>
  `;

  const text = `Hi ${orderDetails.customerName || 'Valued Customer'},\n\n${statusMessage}\n\nOrder Number: ${orderDetails.orderNumber}\nStatus: ${orderStatus.replace(/_/g, ' ')}\n${orderDetails.total ? `Total: $${parseFloat(orderDetails.total).toFixed(2)}\n` : ''}${orderDetails.estimatedReady ? `Estimated Ready: ${new Date(orderDetails.estimatedReady).toLocaleDateString()}\n` : ''}\nThank you for choosing Laundry Services!`;

  const msg = {
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    text,
    html
  };

  try {
    const result = await sgMail.send(msg);
    console.log(`📧 Email sent to ${to} for order ${orderDetails.orderNumber} (status: ${orderStatus})`);
    return { success: true, statusCode: result[0].statusCode };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.response?.body || error.message);
    throw error;
  }
};

/**
 * Send a subscription-related email.
 * @param {string} to - Customer email address
 * @param {string} eventType - 'renewal_success' | 'renewal_failed' | 'cancelled' | 'created'
 * @param {Object} details - { customerName, planName, amount, nextRenewalDate }
 */
const sendSubscriptionEmail = async (to, eventType, details) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('⚠️  SENDGRID_API_KEY not configured — skipping subscription email');
    return { skipped: true };
  }

  const subjects = {
    created: `Welcome to ${details.planName} — Subscription Activated`,
    renewal_success: `Subscription Renewed — ${details.planName}`,
    renewal_failed: `Action Required: Subscription Renewal Failed`,
    cancelled: `Subscription Cancelled — ${details.planName}`
  };

  const messages = {
    created: `Your ${details.planName} subscription has been activated successfully. You will be billed $${details.amount} on ${details.nextRenewalDate}.`,
    renewal_success: `Your ${details.planName} subscription has been renewed successfully for $${details.amount}. Next renewal: ${details.nextRenewalDate}.`,
    renewal_failed: `We were unable to process your subscription renewal for ${details.planName}. Please update your payment method to avoid service interruption.`,
    cancelled: `Your ${details.planName} subscription has been cancelled. You will retain access until the end of the current billing period.`
  };

  const msg = {
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: subjects[eventType] || 'Subscription Update',
    text: `Hi ${details.customerName || 'Valued Customer'},\n\n${messages[eventType] || 'Your subscription status has changed.'}\n\nThank you for choosing Laundry Services!`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
      <h2 style="color: #1a73e8;">Laundry Services</h2>
      <p>Hi ${details.customerName || 'Valued Customer'},</p>
      <p>${messages[eventType] || 'Your subscription status has changed.'}</p>
      <p>Thank you for choosing Laundry Services!</p>
    </div>`
  };

  try {
    const result = await sgMail.send(msg);
    console.log(`📧 Subscription email (${eventType}) sent to ${to}`);
    return { success: true, statusCode: result[0].statusCode };
  } catch (error) {
    console.error(`❌ Failed to send subscription email to ${to}:`, error.response?.body || error.message);
    throw error;
  }
};

module.exports = { sendOrderStatusEmail, sendSubscriptionEmail };
