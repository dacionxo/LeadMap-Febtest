export interface User {
  id: string
  email: string
  name: string
  role?: 'user' | 'admin'
  trial_end: string
  is_subscribed: boolean
  plan_tier: 'free' | 'starter' | 'pro'
  stripe_customer_id?: string
  stripe_subscription_id?: string
  created_at: string
  updated_at: string
}

export interface Listing {
  id: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  price_drop_percent: number
  days_on_market: number
  url: string
  latitude?: number
  longitude?: number
  source?: string
  source_url?: string
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  active?: boolean
  expired?: boolean
  expired_at?: string | null
  last_seen?: string | null
  enrichment_source?: string | null
  enrichment_confidence?: number | null
  geo_source?: string | null
  radius_km?: number | null
  created_at: string
  updated_at: string
}

export type Lead = Listing // Alias for consistency with new fields

export interface EmailTemplate {
  id: string
  title: string
  body: string
  category?: string | null
  created_at?: string
  updated_at?: string
  created_by?: string | null
}

export interface ProbateLead {
  id: string
  case_number: string
  decedent_name: string
  address: string
  city: string
  state: string
  zip: string
  filing_date?: string | null
  source?: string | null
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface PricingPlan {
  id: string
  name: string
  price: number
  priceId: string
  features: string[]
  popular: boolean
}
