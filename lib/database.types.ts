// Generated from the Supabase schema (public). Regenerate after every migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          adobe_reason: string | null
          adobe_reviewed_at: string | null
          adobe_status: string | null
          category: string | null
          concept: string | null
          created_at: string
          exported_at: string | null
          id: string
          job_id: string
          keywords: string[]
          model: string
          needs_release: boolean
          path_count: number | null
          phash: string | null
          preview_path: string | null
          provider: string
          qc_notes: Json
          qc_status: string
          svg_path: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          adobe_reason?: string | null
          adobe_reviewed_at?: string | null
          adobe_status?: string | null
          category?: string | null
          concept?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          job_id: string
          keywords?: string[]
          model: string
          needs_release?: boolean
          path_count?: number | null
          phash?: string | null
          preview_path?: string | null
          provider: string
          qc_notes?: Json
          qc_status?: string
          svg_path?: string | null
          title?: string | null
          user_id?: string
        }
        Update: {
          adobe_reason?: string | null
          adobe_reviewed_at?: string | null
          adobe_status?: string | null
          category?: string | null
          concept?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          job_id?: string
          keywords?: string[]
          model?: string
          needs_release?: boolean
          path_count?: number | null
          phash?: string | null
          preview_path?: string | null
          provider?: string
          qc_notes?: Json
          qc_status?: string
          svg_path?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_job_fk"
            columns: ["job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      exports: {
        Row: {
          asset_count: number
          created_at: string
          csv_path: string | null
          id: string
          user_id: string
          zip_path: string | null
        }
        Insert: {
          asset_count?: number
          created_at?: string
          csv_path?: string | null
          id?: string
          user_id?: string
          zip_path?: string | null
        }
        Update: {
          asset_count?: number
          created_at?: string
          csv_path?: string | null
          id?: string
          user_id?: string
          zip_path?: string | null
        }
        Relationships: []
      }
      model_benchmarks: {
        Row: {
          created_at: string
          id: string
          results: Json
          setup: Json
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          results?: Json
          setup: Json
          status?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          results?: Json
          setup?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          count: number
          created_at: string
          id: string
          palette: Json
          status: string
          style: string
          theme_id: string | null
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          palette?: Json
          status?: string
          style: string
          theme_id?: string | null
          user_id?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          palette?: Json
          status?: string
          style?: string
          theme_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_theme_fk"
            columns: ["theme_id", "user_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      provider_usage: {
        Row: {
          cost_idr: number
          cost_usd: number
          created_at: string
          id: string
          kind: string
          model: string
          ok: boolean
          provider: string
          user_id: string
        }
        Insert: {
          cost_idr?: number
          cost_usd?: number
          created_at?: string
          id?: string
          kind: string
          model: string
          ok?: boolean
          provider: string
          user_id?: string
        }
        Update: {
          cost_idr?: number
          cost_usd?: number
          created_at?: string
          id?: string
          kind?: string
          model?: string
          ok?: boolean
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      research_runs: {
        Row: {
          cost_idr: number
          model: string | null
          provider: string | null
          trends_missing: boolean
          created_at: string
          id: string
          period_end: string
          period_start: string
          region: string
          user_id: string
        }
        Insert: {
          cost_idr?: number
          model?: string | null
          provider?: string | null
          trends_missing?: boolean
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          region: string
          user_id?: string
        }
        Update: {
          cost_idr?: number
          model?: string | null
          provider?: string | null
          trends_missing?: boolean
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          region?: string
          user_id?: string
        }
        Relationships: []
      }
      themes: {
        Row: {
          ai_competition: number | null
          ai_demand: number | null
          event_weight: number
          competition_score: number | null
          country: string | null
          created_at: string
          demand_score: number | null
          event: string | null
          id: string
          opportunity_score: number | null
          run_id: string | null
          seed_keywords: string[]
          title: string
          trend_score: number | null
          adobe_result_count: number | null
          upload_by: string | null
          user_id: string
        }
        Insert: {
          ai_competition?: number | null
          ai_demand?: number | null
          event_weight?: number
          competition_score?: number | null
          country?: string | null
          created_at?: string
          demand_score?: number | null
          event?: string | null
          id?: string
          opportunity_score?: number | null
          run_id?: string | null
          seed_keywords?: string[]
          title: string
          trend_score?: number | null
          adobe_result_count?: number | null
          upload_by?: string | null
          user_id?: string
        }
        Update: {
          ai_competition?: number | null
          ai_demand?: number | null
          event_weight?: number
          competition_score?: number | null
          country?: string | null
          created_at?: string
          demand_score?: number | null
          event?: string | null
          id?: string
          opportunity_score?: number | null
          run_id?: string | null
          seed_keywords?: string[]
          title?: string
          trend_score?: number | null
          adobe_result_count?: number | null
          upload_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "themes_run_fk"
            columns: ["run_id", "user_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          banned_words: string[]
          created_at: string
          default_style: string
          kenari_monthly_budget_idr: number
          kenari_image_model: string
          kenari_text_model: string
          palettes: Json
          provider_order: Json
          recraft_monthly_budget_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          banned_words?: string[]
          created_at?: string
          default_style?: string
          kenari_monthly_budget_idr?: number
          kenari_image_model?: string
          kenari_text_model?: string
          palettes?: Json
          provider_order?: Json
          recraft_monthly_budget_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          banned_words?: string[]
          created_at?: string
          default_style?: string
          kenari_monthly_budget_idr?: number
          kenari_image_model?: string
          kenari_text_model?: string
          palettes?: Json
          provider_order?: Json
          recraft_monthly_budget_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      provider_cost_since: {
        Args: { p_provider: string; p_since: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicTables = Database["public"]["Tables"]

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"]
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]["Insert"]
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]["Update"]
