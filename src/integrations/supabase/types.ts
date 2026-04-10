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
      assign_log: {
        Row: {
          assigned_by_type: string | null
          assigned_by_user: string | null
          created_at: string
          developer_id: string | null
          id: string
          prev_developer_id: string | null
          reason: string | null
          task_id: string | null
        }
        Insert: {
          assigned_by_type?: string | null
          assigned_by_user?: string | null
          created_at?: string
          developer_id?: string | null
          id?: string
          prev_developer_id?: string | null
          reason?: string | null
          task_id?: string | null
        }
        Update: {
          assigned_by_type?: string | null
          assigned_by_user?: string | null
          created_at?: string
          developer_id?: string | null
          id?: string
          prev_developer_id?: string | null
          reason?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assign_log_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assign_log_prev_developer_id_fkey"
            columns: ["prev_developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assign_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          branch: string | null
          commit_sha: string | null
          created_at: string
          deploy_log: string | null
          deploy_type: string | null
          deployed_by: string | null
          environment: string
          fail_reason: string | null
          id: string
          product_id: string
          rollback_version: string | null
          status: string | null
          updated_at: string
          version: string
        }
        Insert: {
          branch?: string | null
          commit_sha?: string | null
          created_at?: string
          deploy_log?: string | null
          deploy_type?: string | null
          deployed_by?: string | null
          environment?: string
          fail_reason?: string | null
          id?: string
          product_id: string
          rollback_version?: string | null
          status?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          branch?: string | null
          commit_sha?: string | null
          created_at?: string
          deploy_log?: string | null
          deploy_type?: string | null
          deployed_by?: string | null
          environment?: string
          fail_reason?: string | null
          id?: string
          product_id?: string
          rollback_version?: string | null
          status?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      developers: {
        Row: {
          active: boolean
          capacity_hours_week: number | null
          created_at: string
          current_load_hours: number | null
          email: string
          id: string
          name: string
          office_location: string | null
          role: string | null
          skills: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity_hours_week?: number | null
          created_at?: string
          current_load_hours?: number | null
          email: string
          id?: string
          name: string
          office_location?: string | null
          role?: string | null
          skills?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity_hours_week?: number | null
          created_at?: string
          current_load_hours?: number | null
          email?: string
          id?: string
          name?: string
          office_location?: string | null
          role?: string | null
          skills?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      environments: {
        Row: {
          created_at: string
          deploy_method: string | null
          deploy_path: string | null
          env_vars_encrypted: string | null
          environment: string
          git_branch: string | null
          git_repo: string | null
          health_check_url: string | null
          id: string
          notes: string | null
          product_id: string
          server_host: string | null
          server_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deploy_method?: string | null
          deploy_path?: string | null
          env_vars_encrypted?: string | null
          environment?: string
          git_branch?: string | null
          git_repo?: string | null
          health_check_url?: string | null
          id?: string
          notes?: string | null
          product_id: string
          server_host?: string | null
          server_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deploy_method?: string | null
          deploy_path?: string | null
          env_vars_encrypted?: string | null
          environment?: string
          git_branch?: string | null
          git_repo?: string | null
          health_check_url?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          server_host?: string | null
          server_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          product_id: string | null
          raw_content: string
          sentiment: string | null
          submitted_by: string | null
          updated_at: string
          urgency_score: number | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          raw_content?: string
          sentiment?: string | null
          submitted_by?: string | null
          updated_at?: string
          urgency_score?: number | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          raw_content?: string
          sentiment?: string | null
          submitted_by?: string | null
          updated_at?: string
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          created_by: string | null
          current_version: string | null
          customer_count: number | null
          description: string | null
          external_apis: string | null
          id: string
          last_updated_at: string | null
          market_category: string | null
          name: string
          priority_score: number
          status: string
          tech_stack: string | null
          update_cadence: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version?: string | null
          customer_count?: number | null
          description?: string | null
          external_apis?: string | null
          id?: string
          last_updated_at?: string | null
          market_category?: string | null
          name: string
          priority_score?: number
          status?: string
          tech_stack?: string | null
          update_cadence?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version?: string | null
          customer_count?: number | null
          description?: string | null
          external_apis?: string | null
          id?: string
          last_updated_at?: string | null
          market_category?: string | null
          name?: string
          priority_score?: number
          status?: string
          tech_stack?: string | null
          update_cadence?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          checklist: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          products_included: string | null
          status: string | null
          target_date: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          checklist?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          products_included?: string | null
          status?: string | null
          target_date?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          checklist?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          products_included?: string | null
          status?: string | null
          target_date?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      research: {
        Row: {
          affected_products: string | null
          ai_analysis: string | null
          created_at: string
          id: string
          source_url: string | null
          submitted_by: string | null
          topic: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          affected_products?: string | null
          ai_analysis?: string | null
          created_at?: string
          id?: string
          source_url?: string | null
          submitted_by?: string | null
          topic?: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          affected_products?: string | null
          ai_analysis?: string | null
          created_at?: string
          id?: string
          source_url?: string | null
          submitted_by?: string | null
          topic?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: []
      }
      sprints: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          goal: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          goal?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          goal?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          sort_order: number | null
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number | null
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number | null
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          ai_priority_score: number | null
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          priority: string | null
          product_id: string | null
          source: string | null
          sprint_id: string | null
          status: string | null
          story_points: number | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          ai_priority_score?: number | null
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string | null
          product_id?: string | null
          source?: string | null
          sprint_id?: string | null
          status?: string | null
          story_points?: number | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          ai_priority_score?: number | null
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string | null
          product_id?: string | null
          source?: string | null
          sprint_id?: string | null
          status?: string | null
          story_points?: number | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      versions: {
        Row: {
          breaking_changes: string | null
          changelog: string | null
          created_at: string
          created_by: string | null
          git_branch: string | null
          git_commit: string | null
          id: string
          is_current: boolean | null
          planned_date: string | null
          product_id: string
          release_notes: string | null
          released_at: string | null
          status: string | null
          tasks_included: string | null
          title: string | null
          updated_at: string
          version: string
          version_type: string | null
        }
        Insert: {
          breaking_changes?: string | null
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          git_branch?: string | null
          git_commit?: string | null
          id?: string
          is_current?: boolean | null
          planned_date?: string | null
          product_id: string
          release_notes?: string | null
          released_at?: string | null
          status?: string | null
          tasks_included?: string | null
          title?: string | null
          updated_at?: string
          version: string
          version_type?: string | null
        }
        Update: {
          breaking_changes?: string | null
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          git_branch?: string | null
          git_commit?: string | null
          id?: string
          is_current?: boolean | null
          planned_date?: string | null
          product_id?: string
          release_notes?: string | null
          released_at?: string | null
          status?: string | null
          tasks_included?: string | null
          title?: string | null
          updated_at?: string
          version?: string
          version_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_page_comments: {
        Row: {
          anchor: string | null
          content: string
          created_at: string
          id: string
          page_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor?: string | null
          content?: string
          created_at?: string
          id?: string
          page_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor?: string | null
          content?: string
          created_at?: string
          id?: string
          page_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wiki_page_versions: {
        Row: {
          change_summary: string | null
          content: string | null
          created_at: string
          edited_by: string | null
          id: string
          page_id: string
          title: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          content?: string | null
          created_at?: string
          edited_by?: string | null
          id?: string
          page_id: string
          title: string
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          content?: string | null
          created_at?: string
          edited_by?: string | null
          id?: string
          page_id?: string
          title?: string
          version_number?: number
        }
        Relationships: []
      }
      wiki_pages: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          is_template: boolean | null
          last_edited_by: string | null
          parent_id: string | null
          sort_order: number | null
          space_id: string
          template_category: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean | null
          last_edited_by?: string | null
          parent_id?: string | null
          sort_order?: number | null
          space_id: string
          template_category?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean | null
          last_edited_by?: string | null
          parent_id?: string | null
          sort_order?: number | null
          space_id?: string
          template_category?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      wiki_spaces: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "developer" | "viewer"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "manager", "developer", "viewer"],
    },
  },
} as const
