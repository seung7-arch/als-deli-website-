# Stripe Integration Guide for Al's Deli

## 🎯 Goal
Enable customers to pay online using Stripe Checkout, then send confirmed orders to your KDS via Make.com.

---

## 🔄 Payment Flow Overview

```
Customer Orders → Stripe Payment → Make.com Webhook → KDS + Email Confirmation
```

**Detailed Steps:**
1. Customer builds order on website
2. Clicks "PAY NOW" → Stripe Checkout opens
3. Customer enters card info and pays
4. Stripe redirects back to confirmation page
5. Webhook triggers Make.com scenario
6. Order sent to KDS + email confirmation sent

---

## ⚙️ Implementation Options

### **Option A: Make.com Stripe Integration (Easiest)**
✅ No coding required
✅ Uses your existing Make.com account
❌ Requires Make.com Pro plan ($9/mo minimum)

### **Option B: Netlify Functions (More Secure)**
✅ Free (included with Netlify)
✅ More secure (secret key never exposed)
❌ Requires basic JavaScript knowledge

**Recommendation: Start with Option A, upgrade to Option B later if needed**

---

## 📝 OPTION A: Make.com Stripe Integration

### Step 1: Create Stripe Module in Make.com

1. **Open your existing Make.com scenario**
2. **Add a new path** for website orders (after the webhook)
3. **Add Stripe module**: "Create Checkout Session"

### Step 2: Configure Stripe Module

**Module Settings:**
```
Connection: [Create new Stripe connection]
  → Use your Stripe SECRET KEY (sk_test_... or sk_live_...)

Mode: payment

Success URL: https://alscarryout.com/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}

Cancel URL: https://alscarryout.com/checkout.html

Line Items:
  - Price Data:
      Currency: usd
      Product Data:
        Name: {{order_summary}}
      Unit Amount: {{total * 100}} (Stripe uses cents!)
  - Quantity: 1

Customer Email: {{customer_phone}}@alscarryout.com (or collect email on checkout)

Metadata:
  customer_name: {{customer_name}}
  customer_phone: {{customer_phone}}
  pickup_time: {{pickup_time}}
  special_instructions: {{special_instructions}}
  order_items: {{json(items)}}
```

### Step 3: Update checkout.html

Replace the `createStripeCheckoutSession()` function:

```javascript
async function createStripeCheckoutSession(orderInfo) {
  const payload = {
    action: 'create_checkout',
    customer_name: orderInfo.name,
    customer_phone: orderInfo.phone,
    pickup_time: orderInfo.pickupTime,
    special_instructions: orderInfo.instructions,
    order_summary: orderInfo.items.map(i => 
      `${i.quantity}x ${i.name}`
    ).join(', '),
    items: orderInfo.items,
    subtotal: orderInfo.subtotal,
    tax: orderInfo.tax,
    total: orderInfo.total,
    source: 'website_checkout'
  };

  // Call your Make.com webhook
  const response = await fetch('https://hook.us2.make.com/YOUR_WEBHOOK_URL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  
  return {
    sessionId: data.sessionId  // Make.com returns this from Stripe module
  };
}
```

### Step 4: Make.com Scenario Flow

```
Webhook Received
  ↓
[Router]
  ↓
  ├─→ If source = "kiosk_v2" → Send to KDS (existing flow)
  ↓
  └─→ If source = "website_checkout"
       ↓
       [Stripe: Create Checkout Session]
       ↓
       [HTTP Response: Return session.id]
       ↓
       (Wait for Stripe webhook confirmation)
       ↓
       [Send to KDS]
       ↓
       [Send Email Confirmation]
```

### Step 5: Set Up Stripe Webhook in Make.com

1. **Add new Webhook module** (separate from your existing one)
2. **Copy the webhook URL** Make.com provides
3. **Go to Stripe Dashboard** → Developers → Webhooks
4. **Click "Add endpoint"**
5. **Enter Make.com webhook URL**
6. **Select events:**
   - `checkout.session.completed`
   - `payment_intent.succeeded`
7. **Save**

### Step 6: Handle Stripe Webhook in Make.com

When Stripe sends webhook:
```
Stripe Webhook Received
  ↓
[Extract metadata]
  ↓
[Format order for KDS]
  ↓
[Send to your KDS webhook]
  ↓
[Send email confirmation]
```

---

## 📝 OPTION B: Netlify Functions (Advanced)

### Step 1: Create Netlify Function

Create file: `netlify/functions/create-checkout.js`

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Al's Deli Order - ${data.customer_name}`,
            description: data.order_summary,
          },
          unit_amount: Math.round(data.total * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://alscarryout.com/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://alscarryout.com/checkout.html',
      metadata: {
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        pickup_time: data.pickup_time,
        special_instructions: data.special_instructions,
        order_items: JSON.stringify(data.items),
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### Step 2: Update checkout.html

```javascript
async function createStripeCheckoutSession(orderInfo) {
  const response = await fetch('/.netlify/functions/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: orderInfo.name,
      customer_phone: orderInfo.phone,
      pickup_time: orderInfo.pickupTime,
      special_instructions: orderInfo.instructions,
      order_summary: orderInfo.items.map(i => 
        `${i.quantity}x ${i.name}`
      ).join(', '),
      items: orderInfo.items,
      total: orderInfo.total,
    })
  });

  const data = await response.json();
  return { sessionId: data.sessionId };
}
```

### Step 3: Set Environment Variable in Netlify

1. Go to Netlify Dashboard → Site settings → Environment variables
2. Add: `STRIPE_SECRET_KEY` = `sk_test_...` (or `sk_live_...`)

### Step 4: Deploy

```bash
npm install stripe
git add .
git commit -m "Add Stripe payment function"
git push
```

Netlify will automatically deploy the function.

---

## 🧪 Testing Your Integration

### Test Mode (Use Stripe Test Keys)

**Test Credit Cards:**
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **3D Secure:** 4000 0027 6000 3184

**Any expiry date in the future, any CVC**

### Testing Checklist:

1. [ ] Place order on website
2. [ ] Complete Stripe checkout with test card
3. [ ] Verify redirect to confirmation page
4. [ ] Check Make.com scenario executed
5. [ ] Confirm order appeared in KDS
6. [ ] Verify email was sent

---

## 📧 Order Confirmation Email Template

Add this to your Make.com scenario after payment success:

**Gmail/Email Module:**
```
To: {{customer_phone}}@alscarryout.com
Subject: ✅ Order Confirmed - Al's Deli

Hi {{customer_name}},

Thank you for your order! We're preparing your food now.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ORDER DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{order_summary}}

Subtotal: ${{subtotal}}
Tax:      ${{tax}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:    ${{total}}

⏰ Pickup Time: {{pickup_time}}

📍 PICKUP LOCATION:
Al's Deli
1003 8th St. SE
Washington, DC 20003

📞 Questions? Call (202) 543-7662

Thank you for choosing Al's Deli!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by Volo AI
```

---

## 🔒 Security Best Practices

### DO:
✅ Use Stripe's official libraries
✅ Store secret keys in environment variables
✅ Validate webhook signatures from Stripe
✅ Use HTTPS everywhere
✅ Test in test mode before going live

### DON'T:
❌ Put secret keys in your HTML/JavaScript
❌ Skip webhook signature verification
❌ Store card details yourself
❌ Process payments without SSL

---

## 💸 Going Live

### Checklist Before Switching to Live Mode:

1. [ ] Complete Stripe business verification
2. [ ] Test full payment flow in test mode
3. [ ] Update all `pk_test_` keys to `pk_live_`
4. [ ] Update all `sk_test_` keys to `sk_live_`
5. [ ] Re-configure webhooks for live mode
6. [ ] Do a $1 test transaction and refund it
7. [ ] Monitor first 10 real orders closely

---

## 🆘 Troubleshooting

### Error: "No such checkout session"
- Session ID not being passed correctly
- Check URL parameters in redirect
- Verify webhook is receiving session ID

### Payment succeeds but order doesn't reach KDS
- Check Make.com scenario execution history
- Verify webhook endpoint is correct
- Check for errors in Stripe webhook logs

### "Invalid API Key"
- Using test key in live mode (or vice versa)
- Key not set in environment variables
- Typo in API key

---

## 📊 Monitoring

### Daily:
- Check Stripe Dashboard for payments
- Review Make.com execution history
- Monitor for failed webhooks

### Weekly:
- Review payment success rate
- Check for refund requests
- Analyze peak ordering times

---

## 🔄 Alternative: Square Integration

If you prefer Square (since Al's may already use Square POS):

1. Use Square Checkout instead of Stripe
2. Similar setup process
3. Easier reconciliation if using Square POS
4. Slightly higher fees (2.9% + 30¢)

**Stripe vs Square:**
- Stripe: Better developer experience, more features
- Square: Better if you use Square POS, easier reconciliation

---

## ✅ Final Notes

- **Start with test mode** - don't go live until fully tested
- **Keep secret keys secure** - never commit to GitHub
- **Monitor first week closely** - catch issues early
- **Have a backup plan** - phone orders still work if website has issues

**Questions?** Reference Stripe docs: https://stripe.com/docs/payments/checkout

Good luck! 🚀
