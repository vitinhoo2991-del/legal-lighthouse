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
          document_id: string | null
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
          document_id?: string | null
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
          document_id?: string | null
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
            foreignKeyName: "ai_usage_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
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
      calendar_event_participants: {
        Row: {
          created_at: string
          event_id: string
          external_email: string | null
          external_name: string | null
          external_phone: string | null
          id: string
          office_id: string
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          external_email?: string | null
          external_name?: string | null
          external_phone?: string | null
          id?: string
          office_id: string
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          external_email?: string | null
          external_name?: string | null
          external_phone?: string | null
          id?: string
          office_id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_participants_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          assigned_to: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          is_deadline: boolean
          lead_id: string | null
          location: string | null
          meeting_url: string | null
          office_id: string
          opportunity_id: string | null
          priority: Database["public"]["Enums"]["calendar_priority"]
          process_reference: string | null
          start_at: string
          status: Database["public"]["Enums"]["calendar_event_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          all_day?: boolean
          assigned_to?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at: string
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          is_deadline?: boolean
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          office_id: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["calendar_priority"]
          process_reference?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["calendar_event_status"]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          all_day?: boolean
          assigned_to?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          is_deadline?: boolean
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          office_id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["calendar_priority"]
          process_reference?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["calendar_event_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_reminders: {
        Row: {
          created_at: string
          event_id: string
          id: string
          minutes_before: number
          office_id: string
          profile_id: string | null
          remind_at: string
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          minutes_before?: number
          office_id: string
          profile_id?: string | null
          remind_at: string
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          minutes_before?: number
          office_id?: string
          profile_id?: string | null
          remind_at?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_reminders_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_reminders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assigned_to: string | null
          conversation_id: string
          id: string
          office_id: string
          transfer_reason: string | null
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to?: string | null
          conversation_id: string
          id?: string
          office_id: string
          transfer_reason?: string | null
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to?: string | null
          conversation_id?: string
          id?: string
          office_id?: string
          transfer_reason?: string | null
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          actor_profile_id: string | null
          conversation_id: string
          created_at: string
          description: string
          event_type: Database["public"]["Enums"]["conversation_event_type"]
          id: string
          metadata: Json
          office_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          conversation_id: string
          created_at?: string
          description: string
          event_type: Database["public"]["Enums"]["conversation_event_type"]
          id?: string
          metadata?: Json
          office_id: string
        }
        Update: {
          actor_profile_id?: string | null
          conversation_id?: string
          created_at?: string
          description?: string
          event_type?: Database["public"]["Enums"]["conversation_event_type"]
          id?: string
          metadata?: Json
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_notes: {
        Row: {
          author_profile_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          office_id: string
        }
        Insert: {
          author_profile_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          office_id: string
        }
        Update: {
          author_profile_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_at: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          office_id: string
          opportunity_id: string
          owner_profile_id: string | null
          status: Database["public"]["Enums"]["crm_activity_status"]
          type: Database["public"]["Enums"]["crm_activity_type"]
          updated_at: string
        }
        Insert: {
          activity_at?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          office_id: string
          opportunity_id: string
          owner_profile_id?: string | null
          status?: Database["public"]["Enums"]["crm_activity_status"]
          type: Database["public"]["Enums"]["crm_activity_type"]
          updated_at?: string
        }
        Update: {
          activity_at?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          office_id?: string
          opportunity_id?: string
          owner_profile_id?: string | null
          status?: Database["public"]["Enums"]["crm_activity_status"]
          type?: Database["public"]["Enums"]["crm_activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          last_activity_at: string
          lead_id: string | null
          loss_reason: string | null
          lost_at: string | null
          lost_by: string | null
          office_id: string
          pipeline_id: string
          probability: number
          source: string | null
          stage_changed_at: string
          stage_id: string
          title: string
          updated_at: string
          won_at: string | null
          won_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string
          lead_id?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          lost_by?: string | null
          office_id: string
          pipeline_id: string
          probability?: number
          source?: string | null
          stage_changed_at?: string
          stage_id: string
          title: string
          updated_at?: string
          won_at?: string | null
          won_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string
          lead_id?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          lost_by?: string | null
          office_id?: string
          pipeline_id?: string
          probability?: number
          source?: string | null
          stage_changed_at?: string
          stage_id?: string
          title?: string
          updated_at?: string
          won_at?: string | null
          won_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_lost_by_fkey"
            columns: ["lost_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_won_by_fkey"
            columns: ["won_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          office_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          office_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          office_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stage_history: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          description: string
          from_stage_id: string | null
          id: string
          metadata: Json
          office_id: string
          opportunity_id: string
          to_stage_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          description: string
          from_stage_id?: string | null
          id?: string
          metadata?: Json
          office_id: string
          opportunity_id: string
          to_stage_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          description?: string
          from_stage_id?: string | null
          id?: string
          metadata?: Json
          office_id?: string
          opportunity_id?: string
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stage_history_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_history_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["crm_stage_kind"]
          name: string
          office_id: string
          pipeline_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["crm_stage_kind"]
          name: string
          office_id: string
          pipeline_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["crm_stage_kind"]
          name?: string
          office_id?: string
          pipeline_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          office_id: string
          opportunity_id: string
          priority: Database["public"]["Enums"]["crm_task_priority"]
          status: Database["public"]["Enums"]["crm_activity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          office_id: string
          opportunity_id: string
          priority?: Database["public"]["Enums"]["crm_task_priority"]
          status?: Database["public"]["Enums"]["crm_activity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          office_id?: string
          opportunity_id?: string
          priority?: Database["public"]["Enums"]["crm_task_priority"]
          status?: Database["public"]["Enums"]["crm_activity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      document_ai_analyses: {
        Row: {
          answer: string | null
          completed_at: string | null
          completion_tokens: number | null
          created_at: string
          document_id: string
          duration_ms: number | null
          error_message: string | null
          estimated_cost: number | null
          id: string
          kind: Database["public"]["Enums"]["document_analysis_kind"]
          model: string
          office_id: string
          prompt_tokens: number | null
          prompt_version: string | null
          question: string | null
          requested_by: string | null
          result: Json | null
          status: string
          total_tokens: number | null
        }
        Insert: {
          answer?: string | null
          completed_at?: string | null
          completion_tokens?: number | null
          created_at?: string
          document_id: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["document_analysis_kind"]
          model: string
          office_id: string
          prompt_tokens?: number | null
          prompt_version?: string | null
          question?: string | null
          requested_by?: string | null
          result?: Json | null
          status?: string
          total_tokens?: number | null
        }
        Update: {
          answer?: string | null
          completed_at?: string | null
          completion_tokens?: number | null
          created_at?: string
          document_id?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["document_analysis_kind"]
          model?: string
          office_id?: string
          prompt_tokens?: number | null
          prompt_version?: string | null
          question?: string | null
          requested_by?: string | null
          result?: Json | null
          status?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_ai_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_ai_analyses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_ai_analyses_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_texts: {
        Row: {
          char_count: number
          content: string
          created_at: string
          document_id: string
          office_id: string
          pages: Json
        }
        Insert: {
          char_count?: number
          content: string
          created_at?: string
          document_id: string
          office_id: string
          pages?: Json
        }
        Update: {
          char_count?: number
          content?: string
          created_at?: string
          document_id?: string
          office_id?: string
          pages?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_texts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_texts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          analysis_status: Database["public"]["Enums"]["document_analysis_status"]
          category: string
          char_count: number | null
          checksum: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          extension: string
          id: string
          lead_id: string | null
          metadata: Json
          mime_type: string
          name: string
          office_id: string
          opportunity_id: string | null
          original_name: string
          page_count: number | null
          process_reference: string | null
          processing_error: string | null
          processing_status: Database["public"]["Enums"]["document_processing_status"]
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          analysis_status?: Database["public"]["Enums"]["document_analysis_status"]
          category?: string
          char_count?: number | null
          checksum?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          extension: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          mime_type: string
          name: string
          office_id: string
          opportunity_id?: string | null
          original_name: string
          page_count?: number | null
          process_reference?: string | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["document_processing_status"]
          size_bytes: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          analysis_status?: Database["public"]["Enums"]["document_analysis_status"]
          category?: string
          char_count?: number | null
          checksum?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          extension?: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          mime_type?: string
          name?: string
          office_id?: string
          opportunity_id?: string | null
          original_name?: string
          page_count?: number | null
          process_reference?: string | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["document_processing_status"]
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_item_versions: {
        Row: {
          changed_by: string | null
          content: string
          content_type: Database["public"]["Enums"]["knowledge_content_type"]
          created_at: string
          enabled: boolean
          id: string
          knowledge_item_id: string
          office_id: string
          priority: number
          source_document_id: string | null
          tags: string[]
          title: string
          version: number
        }
        Insert: {
          changed_by?: string | null
          content: string
          content_type: Database["public"]["Enums"]["knowledge_content_type"]
          created_at?: string
          enabled: boolean
          id?: string
          knowledge_item_id: string
          office_id: string
          priority: number
          source_document_id?: string | null
          tags?: string[]
          title: string
          version: number
        }
        Update: {
          changed_by?: string | null
          content?: string
          content_type?: Database["public"]["Enums"]["knowledge_content_type"]
          created_at?: string
          enabled?: boolean
          id?: string
          knowledge_item_id?: string
          office_id?: string
          priority?: number
          source_document_id?: string | null
          tags?: string[]
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_item_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_item_versions_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_item_versions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_item_versions_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          content: string
          content_type: Database["public"]["Enums"]["knowledge_content_type"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          enabled: boolean
          id: string
          office_id: string
          priority: number
          search_vector: unknown
          source_document_id: string | null
          tags: string[]
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content: string
          content_type?: Database["public"]["Enums"]["knowledge_content_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enabled?: boolean
          id?: string
          office_id: string
          priority?: number
          search_vector?: unknown
          source_document_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          content_type?: Database["public"]["Enums"]["knowledge_content_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enabled?: boolean
          id?: string
          office_id?: string
          priority?: number
          search_vector?: unknown
          source_document_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_search_logs: {
        Row: {
          conversation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          matched_item_ids: string[]
          office_id: string
          query: string
          result_count: number
          source: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          matched_item_ids?: string[]
          office_id: string
          query: string
          result_count?: number
          source?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          matched_item_ids?: string[]
          office_id?: string
          query?: string
          result_count?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_search_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_search_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_history: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          new_score: number
          office_id: string
          previous_score: number | null
          reason: string | null
          source: Database["public"]["Enums"]["lead_score_source"]
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          new_score: number
          office_id: string
          previous_score?: number | null
          reason?: string | null
          source?: Database["public"]["Enums"]["lead_score_source"]
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          new_score?: number
          office_id?: string
          previous_score?: number | null
          reason?: string | null
          source?: Database["public"]["Enums"]["lead_score_source"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_score_history_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_conversation_id: string | null
          assigned_to: string | null
          budget_signal: string | null
          case_summary: string | null
          case_type: string | null
          contact_id: string | null
          created_at: string
          deadline: string | null
          decision_maker: boolean | null
          email: string | null
          has_deadline: boolean | null
          id: string
          intent: Database["public"]["Enums"]["lead_intent"]
          last_interaction_at: string
          last_qualified_at: string | null
          last_qualified_message_id: string | null
          lead_score: number
          lead_temperature: Database["public"]["Enums"]["lead_temperature"]
          location: string | null
          missing_information: string[]
          name: string | null
          office_id: string
          phone: string | null
          practice_area: string | null
          practice_area_match: boolean | null
          qualification_status: Database["public"]["Enums"]["lead_qualification_status"]
          qualification_summary: string | null
          score_reason: string | null
          source: string
          updated_at: string
          urgency: Database["public"]["Enums"]["lead_urgency"]
          whatsapp_conversation_id: string | null
        }
        Insert: {
          ai_conversation_id?: string | null
          assigned_to?: string | null
          budget_signal?: string | null
          case_summary?: string | null
          case_type?: string | null
          contact_id?: string | null
          created_at?: string
          deadline?: string | null
          decision_maker?: boolean | null
          email?: string | null
          has_deadline?: boolean | null
          id?: string
          intent?: Database["public"]["Enums"]["lead_intent"]
          last_interaction_at?: string
          last_qualified_at?: string | null
          last_qualified_message_id?: string | null
          lead_score?: number
          lead_temperature?: Database["public"]["Enums"]["lead_temperature"]
          location?: string | null
          missing_information?: string[]
          name?: string | null
          office_id: string
          phone?: string | null
          practice_area?: string | null
          practice_area_match?: boolean | null
          qualification_status?: Database["public"]["Enums"]["lead_qualification_status"]
          qualification_summary?: string | null
          score_reason?: string | null
          source?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["lead_urgency"]
          whatsapp_conversation_id?: string | null
        }
        Update: {
          ai_conversation_id?: string | null
          assigned_to?: string | null
          budget_signal?: string | null
          case_summary?: string | null
          case_type?: string | null
          contact_id?: string | null
          created_at?: string
          deadline?: string | null
          decision_maker?: boolean | null
          email?: string | null
          has_deadline?: boolean | null
          id?: string
          intent?: Database["public"]["Enums"]["lead_intent"]
          last_interaction_at?: string
          last_qualified_at?: string | null
          last_qualified_message_id?: string | null
          lead_score?: number
          lead_temperature?: Database["public"]["Enums"]["lead_temperature"]
          location?: string | null
          missing_information?: string[]
          name?: string | null
          office_id?: string
          phone?: string | null
          practice_area?: string | null
          practice_area_match?: boolean | null
          qualification_status?: Database["public"]["Enums"]["lead_qualification_status"]
          qualification_summary?: string | null
          score_reason?: string | null
          source?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["lead_urgency"]
          whatsapp_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_ai_conversation_id_fkey"
            columns: ["ai_conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_whatsapp_conversation_id_fkey"
            columns: ["whatsapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string
          event_id: string | null
          id: string
          lead_id: string | null
          office_id: string
          opportunity_id: string | null
          profile_id: string | null
          read_at: string | null
          task_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          lead_id?: string | null
          office_id: string
          opportunity_id?: string | null
          profile_id?: string | null
          read_at?: string | null
          task_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          lead_id?: string | null
          office_id?: string
          opportunity_id?: string | null
          profile_id?: string | null
          read_at?: string | null
          task_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
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
          max_concurrent_conversations: number | null
          name: string
          notification_sound_enabled: boolean
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
          max_concurrent_conversations?: number | null
          name: string
          notification_sound_enabled?: boolean
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
          max_concurrent_conversations?: number | null
          name?: string
          notification_sound_enabled?: boolean
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
          assigned_at: string | null
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          contact_id: string
          created_at: string
          external_conversation_id: string | null
          handed_off_at: string | null
          id: string
          last_message_at: string
          office_id: string
          service_status: Database["public"]["Enums"]["conversation_service_status"]
          status: Database["public"]["Enums"]["ai_conversation_status"]
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_id: string
          created_at?: string
          external_conversation_id?: string | null
          handed_off_at?: string | null
          id?: string
          last_message_at?: string
          office_id: string
          service_status?: Database["public"]["Enums"]["conversation_service_status"]
          status?: Database["public"]["Enums"]["ai_conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_id?: string
          created_at?: string
          external_conversation_id?: string | null
          handed_off_at?: string | null
          id?: string
          last_message_at?: string
          office_id?: string
          service_status?: Database["public"]["Enums"]["conversation_service_status"]
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
            foreignKeyName: "whatsapp_conversations_closed_by_fkey"
            columns: ["closed_by"]
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
      calendar_check_conflict: {
        Args: {
          _assigned_to: string
          _end_at: string
          _ignore_event_id?: string
          _office_id: string
          _start_at: string
        }
        Returns: {
          end_at: string
          id: string
          start_at: string
          title: string
        }[]
      }
      calendar_create_event: {
        Args: { _allow_conflict?: boolean; _payload: Json }
        Returns: Json
      }
      current_office_id: { Args: never; Returns: string }
      has_office_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      knowledge_search: {
        Args: { _limit?: number; _only_enabled?: boolean; _query: string }
        Returns: {
          content: string
          content_type: Database["public"]["Enums"]["knowledge_content_type"]
          enabled: boolean
          id: string
          priority: number
          rank: number
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      knowledge_search_document: {
        Args: { _content: string; _tags: string[]; _title: string }
        Returns: unknown
      }
    }
    Enums: {
      ai_conversation_status: "ai" | "waiting_human" | "human" | "closed"
      ai_hours_mode: "always" | "business_hours"
      ai_message_role: "user" | "assistant" | "system"
      app_role: "owner" | "admin" | "lawyer" | "assistant"
      calendar_event_status:
        | "agendado"
        | "confirmado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "nao_compareceu"
      calendar_event_type:
        | "consulta"
        | "reuniao"
        | "atendimento"
        | "audiencia"
        | "retorno"
        | "ligacao"
        | "videoconferencia"
        | "prazo"
        | "tarefa"
        | "outro"
      calendar_priority: "baixa" | "media" | "alta" | "urgente"
      conversation_event_type:
        | "assumed"
        | "transferred"
        | "returned_to_queue"
        | "status_changed"
        | "closed"
        | "reopened"
        | "ai_enabled"
        | "ai_disabled"
        | "note_created"
        | "message_sent"
      conversation_service_status:
        | "aberta"
        | "em_atendimento"
        | "aguardando_cliente"
        | "aguardando_equipe"
        | "encerrada"
      crm_activity_status:
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      crm_activity_type:
        | "ligacao"
        | "mensagem"
        | "reuniao"
        | "consulta"
        | "proposta"
        | "observacao"
        | "tarefa"
      crm_stage_kind: "aberta" | "ganha" | "perdida"
      crm_task_priority: "baixa" | "media" | "alta" | "urgente"
      document_analysis_kind: "analise" | "pergunta"
      document_analysis_status:
        | "nao_analisado"
        | "analisando"
        | "analisado"
        | "falha"
      document_processing_status:
        | "aguardando"
        | "processando"
        | "processado"
        | "falha"
        | "requer_ocr"
      knowledge_content_type:
        | "faq"
        | "orientacao"
        | "procedimento"
        | "politica"
        | "modelo"
        | "outro"
      lead_intent: "desconhecida" | "informacao" | "avaliando" | "contratar"
      lead_qualification_status:
        | "novo"
        | "em_qualificacao"
        | "qualificado"
        | "incompleto"
        | "desqualificado"
        | "atendimento_humano"
      lead_score_source: "ai" | "user" | "system"
      lead_temperature: "frio" | "morno" | "quente"
      lead_urgency: "desconhecida" | "baixa" | "media" | "alta" | "critica"
      notification_type:
        | "new_conversation"
        | "new_message"
        | "conversation_assigned"
        | "conversation_transferred"
        | "hot_lead"
        | "opportunity_assigned"
        | "opportunity_transferred"
        | "opportunity_stage_changed"
        | "opportunity_won"
        | "opportunity_lost"
        | "task_assigned"
        | "task_due_soon"
        | "task_overdue"
        | "event_assigned"
        | "event_updated"
        | "event_cancelled"
        | "event_reminder"
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
      calendar_event_status: [
        "agendado",
        "confirmado",
        "em_andamento",
        "concluido",
        "cancelado",
        "nao_compareceu",
      ],
      calendar_event_type: [
        "consulta",
        "reuniao",
        "atendimento",
        "audiencia",
        "retorno",
        "ligacao",
        "videoconferencia",
        "prazo",
        "tarefa",
        "outro",
      ],
      calendar_priority: ["baixa", "media", "alta", "urgente"],
      conversation_event_type: [
        "assumed",
        "transferred",
        "returned_to_queue",
        "status_changed",
        "closed",
        "reopened",
        "ai_enabled",
        "ai_disabled",
        "note_created",
        "message_sent",
      ],
      conversation_service_status: [
        "aberta",
        "em_atendimento",
        "aguardando_cliente",
        "aguardando_equipe",
        "encerrada",
      ],
      crm_activity_status: [
        "pendente",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      crm_activity_type: [
        "ligacao",
        "mensagem",
        "reuniao",
        "consulta",
        "proposta",
        "observacao",
        "tarefa",
      ],
      crm_stage_kind: ["aberta", "ganha", "perdida"],
      crm_task_priority: ["baixa", "media", "alta", "urgente"],
      document_analysis_kind: ["analise", "pergunta"],
      document_analysis_status: [
        "nao_analisado",
        "analisando",
        "analisado",
        "falha",
      ],
      document_processing_status: [
        "aguardando",
        "processando",
        "processado",
        "falha",
        "requer_ocr",
      ],
      knowledge_content_type: [
        "faq",
        "orientacao",
        "procedimento",
        "politica",
        "modelo",
        "outro",
      ],
      lead_intent: ["desconhecida", "informacao", "avaliando", "contratar"],
      lead_qualification_status: [
        "novo",
        "em_qualificacao",
        "qualificado",
        "incompleto",
        "desqualificado",
        "atendimento_humano",
      ],
      lead_score_source: ["ai", "user", "system"],
      lead_temperature: ["frio", "morno", "quente"],
      lead_urgency: ["desconhecida", "baixa", "media", "alta", "critica"],
      notification_type: [
        "new_conversation",
        "new_message",
        "conversation_assigned",
        "conversation_transferred",
        "hot_lead",
        "opportunity_assigned",
        "opportunity_transferred",
        "opportunity_stage_changed",
        "opportunity_won",
        "opportunity_lost",
        "task_assigned",
        "task_due_soon",
        "task_overdue",
        "event_assigned",
        "event_updated",
        "event_cancelled",
        "event_reminder",
      ],
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
