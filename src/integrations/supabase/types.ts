export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_agent_settings: {
        Row: {
          after_hours_message: string
          agent_name: string
          behavior: string
          created_at: string
          enabled: boolean
          greeting: string
          handoff_message: string
          hours_days: number[]
          hours_end: string
          hours_mode: Database["public"]["Enums"]["ai_hours_mode"]
          hours_start: string
          id: string
          model: string
          objective: string
          office_id: string
          rules: string
          tones: string[]
          updated_at: string
        }
        Insert: {
          after_hours_message?: string
          agent_name?: string
          behavior?: string
          created_at?: string
          enabled?: boolean
          greeting?: string
          handoff_message?: string
          hours_days?: number[]
          hours_end?: string
          hours_mode?: Database["public"]["Enums"]["ai_hours_mode"]
          hours_start?: string
          id?: string
          model?: string
          objective?: string
          office_id: string
          rules?: string
          tones?: string[]
          updated_at?: string
        }
        Update: {
          after_hours_message?: string
          agent_name?: string
          behavior?: string
          created_at?: string
          enabled?: boolean
          greeting?: string
          handoff_message?: string
          hours_days?: number[]
          hours_end?: string
          hours_mode?: Database["public"]["Enums"]["ai_hours_mode"]
          hours_start?: string
          id?: string
          model?: string
          objective?: string
          office_id?: string
          rules?: string
          tones?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          channel: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string
          office_id: string
          status: Database["public"]["Enums"]["ai_conversation_status"]
          title: string
          updated_at: string
        }
        Insert: {
          channel?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          office_id: string
          status?: Database["public"]["Enums"]["ai_conversation_status"]
          title?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          office_id?: string
          status?: Database["public"]["Enums"]["ai_conversation_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          author_profile_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          office_id: string
          role: Database["public"]["Enums"]["ai_message_role"]
        }
        Insert: {
          author_profile_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          office_id: string
          role: Database["public"]["Enums"]["ai_message_role"]
        }
        Update: {
          author_profile_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          office_id?: string
          role?: Database["public"]["Enums"]["ai_message_role"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          completion_tokens: number | null
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          id: string
          model: string
          office_id: string
          prompt_tokens: number | null
          status: string
          total_tokens: number | null
        }
        Insert: {
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          model: string
          office_id: string
          prompt_tokens?: number | null
          status?: string
          total_tokens?: number | null
        }
        Update: {
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          model?: string
          office_id?: string
          prompt_tokens?: number | null
          status?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
          office_id: string | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          office_id?: string | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          office_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string
          document: string | null
          email: string | null
          goals: string[]
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          phone: string | null
          practice_areas: string[]
          state: string | null
          status: Database["public"]["Enums"]["office_status"]
          timezone: string
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          document?: string | null
          email?: string | null
          goals?: string[]
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          phone?: string | null
          practice_areas?: string[]
          state?: string | null
          status?: Database["public"]["Enums"]["office_status"]
          timezone?: string
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          document?: string | null
          email?: string | null
          goals?: string[]
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          phone?: string | null
          practice_areas?: string[]
          state?: string | null
          status?: Database["public"]["Enums"]["office_status"]
          timezone?: string
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          last_seen_at: string | null
          name: string
          office_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          last_seen_at?: string | null
          name: string
          office_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          office_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          connected_at: string | null
          created_at: string
          display_name: string | null
          external_account_id: string | null
          external_phone_number_id: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          office_id: string
          phone_number: string | null
          status: Database["public"]["Enums"]["whatsapp_connection_status"]
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          external_phone_number_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          office_id: string
          phone_number?: string | null
          status?: Database["public"]["Enums"]["whatsapp_connection_status"]
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          external_account_id?: string | null
          external_phone_number_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          office_id?: string
          phone_number?: string | null
          status?: Database["public"]["Enums"]["whatsapp_connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          created_at: string
          id: string
          name: string | null
          office_id: string
          phone_number: string
          profile_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          office_id: string
          phone_number: string
          profile_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          office_id?: string
          phone_number?: string
          profile_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          ai_enabled: boolean
          assigned_to: string | null
          contact_id: string
          created_at: string
          external_conversation_id: string | null
          handed_off_at: string | null
          id: string
          last_message_at: string
          office_id: string
          status: Database["public"]["Enums"]["ai_conversation_status"]
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          external_conversation_id?: string | null
          handed_off_at?: string | null
          id?: string
          last_message_at?: string
          office_id: string
          status?: Database["public"]["Enums"]["ai_conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          external_conversation_id?: string | null
          handed_off_at?: string | null
          id?: string
          last_message_at?: string
          office_id?: string
          status?: Database["public"]["Enums"]["ai_conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_credentials: {
        Row: {
          access_token: string
          app_secret: string | null
          office_id: string
          updated_at: string
          verify_token: string
        }
        Insert: {
          access_token: string
          app_secret?: string | null
          office_id: string
          updated_at?: string
          verify_token: string
        }
        Update: {
          access_token?: string
          app_secret?: string | null
          office_id?: string
          updated_at?: string
          verify_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credentials_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          author_profile_id: string | null
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: Database["public"]["Enums"]["whatsapp_direction"]
          error_message: string | null
          external_message_id: string | null
          from_ai: boolean
          id: string
          message_type: string
          office_id: string
          read_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["whatsapp_message_status"]
        }
        Insert: {
          author_profile_id?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["whatsapp_direction"]
          error_message?: string | null
          external_message_id?: string | null
          from_ai?: boolean
          id?: string
          message_type?: string
          office_id: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
        }
        Update: {
          author_profile_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["whatsapp_direction"]
          error_message?: string | null
          external_message_id?: string | null
          from_ai?: boolean
          id?: string
          message_type?: string
          office_id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          external_event_id: string
          id: string
          office_id: string | null
          processed: boolean
          processed_at: string | null
          processing_error: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          external_event_id: string
          id?: string
          office_id?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          external_event_id?: string
          id?: string
          office_id?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_office_id: { Args: never; Returns: string }
      has_office_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
    }
    Enums: {
      ai_conversation_status: "ai" | "waiting_human" | "human" | "closed"
      ai_hours_mode: "always" | "business_hours"
      ai_message_role: "user" | "assistant" | "system"
      app_role: "owner" | "admin" | "lawyer" | "assistant"
      office_status: "active" | "suspended" | "cancelled"
      profile_status: "active" | "invited" | "inactive"
      whatsapp_connection_status:
        | "disconnected"
        | "pending"
        | "connected"
        | "error"
      whatsapp_direction: "inbound" | "outbound"
      whatsapp_message_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_conversation_status: ["ai", "waiting_human", "human", "closed"],
      ai_hours_mode: ["always", "business_hours"],
      ai_message_role: ["user", "assistant", "system"],
      app_role: ["owner", "admin", "lawyer", "assistant"],
      office_status: ["active", "suspended", "cancelled"],
      profile_status: ["active", "invited", "inactive"],
      whatsapp_connection_status: [
        "disconnected",
        "pending",
        "connected",
        "error",
      ],
      whatsapp_direction: ["inbound", "outbound"],
      whatsapp_message_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
    },
  },
} as const
