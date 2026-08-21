/**
 * Hand-maintained mirror of supabase/migrations/*.sql.
 *
 * Regenerate from the live project instead of editing by hand once the
 * Supabase CLI is linked:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'user' | 'admin';
export type BillingInterval = 'month' | 'year';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';
export type RunStatus = 'success' | 'error';

/** Shape stored in plans.limits. `null` in a numeric field means unlimited. */
export interface PlanLimits {
  maxFileBytes: number | null;
  maxBatch: number | null;
  runsPerDay: number | null;
  videoPerDay: number | null;
  /** null = kept forever, 0 = not kept at all */
  historyDays: number | null;
  seats: number;
  api: boolean;
  /** unlocks the tools marked access: 'pro' in src/lib/tools.tsx */
  proTools: boolean;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          banned_at: string | null;
          ban_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          banned_at?: string | null;
          ban_reason?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          tagline: string | null;
          monthly_price_cents: number;
          yearly_price_cents: number;
          stripe_price_id_month: string | null;
          stripe_price_id_year: string | null;
          limits: PlanLimits;
          features: string[];
          sort: number;
          active: boolean;
          listed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          tagline?: string | null;
          monthly_price_cents?: number;
          yearly_price_cents?: number;
          stripe_price_id_month?: string | null;
          stripe_price_id_year?: string | null;
          limits?: PlanLimits;
          features?: string[];
          sort?: number;
          active?: boolean;
          listed?: boolean;
        };
        Update: Partial<Database['public']['Tables']['plans']['Insert']>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          interval: BillingInterval;
          status: SubscriptionStatus;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          comped: boolean;
          comped_by: string | null;
          comped_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          interval?: BillingInterval;
          status?: SubscriptionStatus;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          comped?: boolean;
          comped_by?: string | null;
          comped_note?: string | null;
        };
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
        Relationships: [];
      };
      tool_runs: {
        Row: {
          id: string;
          user_id: string;
          tool_slug: string;
          dept: string;
          label: string | null;
          file_count: number;
          input_bytes: number;
          output_bytes: number;
          duration_ms: number;
          status: RunStatus;
          error_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tool_slug: string;
          dept: string;
          label?: string | null;
          file_count?: number;
          input_bytes?: number;
          output_bytes?: number;
          duration_ms?: number;
          status?: RunStatus;
          error_code?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tool_runs']['Insert']>;
        Relationships: [];
      };
      usage_daily: {
        Row: {
          user_id: string;
          day: string;
          tool_slug: string;
          runs: number;
          bytes: number;
        };
        Insert: {
          user_id: string;
          day?: string;
          tool_slug: string;
          runs?: number;
          bytes?: number;
        };
        Update: Partial<Database['public']['Tables']['usage_daily']['Insert']>;
        Relationships: [];
      };
      stripe_events: {
        Row: { id: string; type: string; processed_at: string };
        Insert: { id: string; type: string; processed_at?: string };
        Update: Partial<Database['public']['Tables']['stripe_events']['Insert']>;
        Relationships: [];
      };
      admin_audit: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          meta: Json;
          ip: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_email?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          meta?: Json;
          ip?: string | null;
        };
        Update: Partial<Database['public']['Tables']['admin_audit']['Insert']>;
        Relationships: [];
      };
      feature_flags: {
        Row: { key: string; enabled: boolean; payload: Json; updated_at: string };
        Insert: { key: string; enabled?: boolean; payload?: Json };
        Update: Partial<Database['public']['Tables']['feature_flags']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      prune_tool_history: {
        Args: Record<string, never>;
        Returns: number;
      };
      record_tool_run: {
        Args: {
          p_tool_slug: string;
          p_dept: string;
          p_label: string | null;
          p_file_count: number;
          p_input_bytes: number;
          p_output_bytes: number;
          p_duration_ms: number;
          p_status: RunStatus;
          p_error_code: string | null;
        };
        Returns: string | null;
      };
    };
    Enums: {
      user_role: UserRole;
      billing_interval: BillingInterval;
      subscription_status: SubscriptionStatus;
      run_status: RunStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type PlanRow = Database['public']['Tables']['plans']['Row'];
export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
export type ToolRun = Database['public']['Tables']['tool_runs']['Row'];
export type UsageDaily = Database['public']['Tables']['usage_daily']['Row'];
export type AdminAudit = Database['public']['Tables']['admin_audit']['Row'];
