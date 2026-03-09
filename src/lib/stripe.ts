import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const PRICE_ID = 'price_0T995nUYpWUgnHYRpA52b0Hg'
