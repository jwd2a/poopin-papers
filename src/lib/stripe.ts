import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

// Lazy-initialized proxy so module can be imported at build time without STRIPE_SECRET_KEY
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// Live: price_0T995nUYpWUgnHYRpA52b0Hg
// Test: price_0T9B8eUYpWUgnHYRBv7sujV9
export const PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_0T9B8eUYpWUgnHYRBv7sujV9'
