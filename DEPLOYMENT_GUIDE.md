# Al's Deli Website - Deployment Guide

## 🚀 Complete Setup Instructions

This guide will walk you through deploying your new Al's Deli website with Stripe payment integration.

---

## 📋 What You'll Need

- [ ] Netlify account (free - netlify.com/signup)
- [ ] Stripe account (free - stripe.com/register)
- [ ] GitHub account (free - github.com/join)
- [ ] Access to alscarryout.com DNS settings
- [ ] Your existing Make.com account

**Time Required:** 45-60 minutes

---

## STEP 1: Set Up Stripe Account

### 1.1 Create Stripe Account
1. Go to https://stripe.com/register
2. Sign up with your business email
3. Complete business verification (can activate "Test Mode" immediately)

### 1.2 Get API Keys
1. Go to Stripe Dashboard → Developers → API Keys
2. Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
3. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)
4. Save these somewhere secure - you'll need them soon

### 1.3 Enable Stripe Checkout
1. Go to Settings → Checkout settings
2. Enable "Stripe Checkout"
3. Set Success URL: `https://alscarryout.com/order-confirmed.html`
4. Set Cancel URL: `https://alscarryout.com/checkout.html`

---

## STEP 2: Update Website Files

### 2.1 Update checkout.html
Open `checkout.html` and find this line (around line 131):
```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_STRIPE_KEY_HERE';
```

Replace with your actual Stripe **Publishable Key**:
```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51AbCd123...'; // Your real key
```

### 2.2 Important Note on Stripe Integration
The current `checkout.html` has a **placeholder** Stripe integration. To fully enable payments, you need to either:

**Option A: Use Make.com to Create Stripe Sessions (Recommended)**
1. Create a new Make.com scenario
2. Add Stripe "Create Checkout Session" module
3. Use your Stripe Secret Key in Make.com
4. Update the `createStripeCheckoutSession()` function in `checkout.html` to call your Make.com webhook
5. Return the `session.id` from Stripe

**Option B: Create a Simple Backend (More Secure)**
1. Create a Netlify Function or use Vercel/Railway
2. Add server-side Stripe integration
3. Call your backend API from `checkout.html`

**See STRIPE_INTEGRATION.md for detailed instructions** (creating this file next)

---

## STEP 3: Deploy to Netlify

### 3.1 Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `als-deli-website`
3. Set to "Public" or "Private" (your choice)
4. Do NOT initialize with README
5. Click "Create Repository"

### 3.2 Upload Files to GitHub
**Option A: Using GitHub Web Interface**
1. Click "uploading an existing file"
2. Drag all your website files into the upload area:
   - index.html
   - order.html
   - order-logic.js
   - checkout.html
   - terms.html
   - privacy.html
   - netlify.toml
3. Click "Commit changes"

**Option B: Using Git Command Line**
```bash
cd /path/to/your/website/files
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/als-deli-website.git
git push -u origin main
```

### 3.3 Deploy to Netlify
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose "GitHub"
4. Authorize Netlify to access your repos
5. Select `als-deli-website`
6. Build settings:
   - Build command: (leave empty)
   - Publish directory: `.` (just a period)
7. Click "Deploy site"

**Your site is now live!** Netlify will give you a URL like `https://random-name-123.netlify.app`

---

## STEP 4: Connect Custom Domain

### 4.1 Add Domain to Netlify
1. In Netlify dashboard, go to Site settings → Domain management
2. Click "Add custom domain"
3. Enter: `alscarryout.com`
4. Click "Verify"
5. Netlify will show you DNS records to add

### 4.2 Update DNS Settings
Go to your domain registrar (where you bought alscarryout.com) and:

1. **Add/Update A Record:**
   - Type: `A`
   - Name: `@`
   - Value: `75.2.60.5` (Netlify's load balancer)

2. **Add CNAME Record:**
   - Type: `CNAME`
   - Name: `www`
   - Value: `random-name-123.netlify.app` (your Netlify URL)

**DNS propagation takes 5 minutes to 48 hours**

### 4.3 Enable HTTPS
1. In Netlify → Domain settings → HTTPS
2. Click "Verify DNS configuration"
3. Click "Provision certificate"
4. Wait 1-2 minutes for SSL setup

**Your site is now live at https://alscarryout.com!** 🎉

---

## STEP 5: Update Make.com Webhook

### 5.1 Modify Your Existing Scenario
1. Go to your Make.com scenario (the one receiving kiosk orders)
2. Add a **Router** after the webhook to handle two flows:
   - **Path 1:** Kiosk orders (source: "kiosk_v2")
   - **Path 2:** Website orders (source: "website_checkout")

### 5.2 Add Email Confirmation Module
For website orders, add:
1. **Gmail/Email Module** → "Send an Email"
2. Map fields:
   - To: `{{customer_phone}}@text.com` (SMS gateway) OR actual email if collected
   - Subject: `Order Confirmation - Al's Deli`
   - Body: Include order details, total, pickup time

**Example Email Template:**
```
Hi {{customer_name}},

Your order has been confirmed!

Order Details:
{{order_summary}}

Total: ${{total}}
Pickup Time: {{pickup_time}}

Thank you for ordering from Al's Deli!
📍 1003 8th St. SE, Washington, DC
📞 (202) 543-7662
```

---

## STEP 6: Testing Checklist

### Test on Desktop:
- [ ] Homepage loads correctly
- [ ] Menu loads all items
- [ ] Can customize items and add to cart
- [ ] Cart shows correct totals
- [ ] Can proceed to checkout
- [ ] Form validation works
- [ ] Stripe payment flow works (test mode)

### Test on Mobile:
- [ ] Responsive design works
- [ ] Cart slides up properly
- [ ] Customizer is usable
- [ ] Checkout form is mobile-friendly

### Test Orders:
- [ ] Place test order (use Stripe test card: `4242 4242 4242 4242`)
- [ ] Verify order appears in Make.com
- [ ] Check KDS receives order
- [ ] Confirm email is sent

**Stripe Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- (Any future date, any CVC)

---

## STEP 7: Go Live

### 7.1 Switch Stripe to Live Mode
1. Complete Stripe business verification
2. In Stripe Dashboard, toggle "Test mode" OFF
3. Get new **Live** API keys (start with `pk_live_` and `sk_live_`)
4. Update `checkout.html` with live keys
5. Update Make.com Stripe module with live secret key
6. Re-deploy to Netlify

### 7.2 Final Checks
- [ ] Test a real $1 order and refund it
- [ ] Update store hours if different
- [ ] Add your social media links (if desired)
- [ ] Set up Google Analytics (optional)

---

## 📊 Monitoring & Maintenance

### Daily:
- Check Make.com scenario runs successfully
- Monitor Stripe dashboard for payments

### Weekly:
- Review order data
- Check for customer feedback

### Monthly:
- Review Netlify analytics
- Update menu/pricing if needed

---

## 🆘 Troubleshooting

### "Cart is empty" when going to checkout
- User's localStorage was cleared
- Tell them to re-add items

### Stripe checkout not loading
- Check your publishable key in checkout.html
- Verify Stripe account is activated
- Check browser console for errors

### Orders not appearing in KDS
- Check Make.com scenario is active
- Verify webhook URL is correct
- Check scenario execution history for errors

### Domain not working
- DNS can take 24-48 hours to propagate
- Use `nslookup alscarryout.com` to check
- Verify A and CNAME records are correct

---

## 📞 Support Resources

- **Netlify Docs:** https://docs.netlify.com
- **Stripe Docs:** https://stripe.com/docs/payments/checkout
- **Make.com Support:** https://www.make.com/en/help

---

## 🎯 Next Steps (Optional Enhancements)

After launch, consider adding:
1. **Order history** for returning customers
2. **Loyalty program** integration
3. **Push notifications** for order status
4. **Online menu photos** (upload to Netlify)
5. **Customer reviews** section
6. **Catering page** for large orders

---

## ✅ Launch Checklist

Before announcing to customers:

- [ ] All test orders work end-to-end
- [ ] Payment processing is live (not test mode)
- [ ] Email confirmations are sending
- [ ] Domain is accessible (alscarryout.com)
- [ ] HTTPS is enabled (green padlock)
- [ ] Mobile experience tested
- [ ] Legal pages reviewed (terms/privacy)
- [ ] Store hours are accurate
- [ ] Contact info is correct

**You're ready to go live!** 🚀

---

## 💰 Cost Summary

| Service | Monthly Cost |
|---------|-------------|
| Netlify Hosting | **$0** (free tier) |
| Stripe Fees | 2.9% + 30¢ per transaction |
| Domain (existing) | Already paid |
| Make.com | Current plan |
| **Total Fixed** | **$0/month** |

**Example:** $1,000 in monthly orders = ~$29 in Stripe fees

---

**Questions?** Call Seung or check the STRIPE_INTEGRATION.md file for payment setup details.

**Good luck with your launch!** 🎉
