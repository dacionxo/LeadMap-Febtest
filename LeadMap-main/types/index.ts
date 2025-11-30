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
  subject?: string | null
  category?: string | null
  version?: number | null
  parent_template_id?: string | null
  folder_path?: string | null
  description?: string | null
  scope?: 'global' | 'user' | 'team'
  team_id?: string | null
  is_active?: boolean | null
  tags?: string[] | null
  allowed_variables?: string[] | null
  created_at?: string
  updated_at?: string
  created_by?: string | null
  // Stats (joined from template_stats)
  stats?: TemplateStats | null
}

export interface TemplateVersion {
  id: string
  template_id: string
  version: number
  title: string
  subject?: string | null
  body: string
  category: string
  folder_path?: string | null
  created_at: string
  created_by?: string | null
  created_by_name?: string | null
  change_notes?: string | null
}

export interface TemplateStats {
  id: string
  template_id: string
  version?: number | null
  total_sent: number
  total_opened: number
  total_clicked: number
  total_replied: number
  total_bounced: number
  total_unsubscribed: number
  open_rate: number
  click_rate: number
  reply_rate: number
  bounce_rate: number
  last_used_at?: string | null
  created_at: string
  updated_at: string
}

export interface TemplateTestSend {
  id: string
  template_id: string
  version?: number | null
  test_email: string
  rendered_subject?: string | null
  rendered_body?: string | null
  test_context?: Record<string, any> | null
  sent_at: string
  sent_by?: string | null
  opened_at?: string | null
  clicked_at?: string | null
}

export interface TemplateFolder {
  id: string
  name: string
  path: string
  parent_folder_id?: string | null
  scope?: 'global' | 'user' | 'team'
  user_id?: string | null
  team_id?: string | null
  created_at: string
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
