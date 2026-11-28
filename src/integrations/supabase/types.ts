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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      configuracoes_loja: {
        Row: {
          id: number
          limite_minimo_pedido: number
        }
        Insert: {
          id?: number
          limite_minimo_pedido?: number
        }
        Update: {
          id?: number
          limite_minimo_pedido?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_name: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          created_at: string
          customer_name: string
          customer_whatsapp: string
          delivery_city: string | null
          delivery_method: string | null
          id: string
          items: Json
          order_number: number
          paid_at: string | null
          payment_method: string
          payment_proof_amount: number | null
          payment_proof_name: string | null
          payment_proof_path: string | null
          payment_proof_type: string | null
          payment_proof_validated_at: string | null
          payment_proof_validated_total: number | null
          pickup_document: string | null
          pickup_name: string | null
          seller_id: string | null
          seller_name: string | null
          status: string
          total: number
          updated_at: string
          user_id: string
          van_contact: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_name?: string | null
          confirmed_by?: string | null
          confirmed_by_name?: string | null
          created_at?: string
          customer_name: string
          customer_whatsapp: string
          delivery_city?: string | null
          delivery_method?: string | null
          id?: string
          items: Json
          order_number?: never
          paid_at?: string | null
          payment_method?: string
          payment_proof_amount?: number | null
          payment_proof_name?: string | null
          payment_proof_path?: string | null
          payment_proof_type?: string | null
          payment_proof_validated_at?: string | null
          payment_proof_validated_total?: number | null
          pickup_document?: string | null
          pickup_name?: string | null
          seller_id?: string | null
          seller_name?: string | null
          status?: string
          total: number
          updated_at?: string
          user_id?: string
          van_contact?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_name?: string | null
          confirmed_by?: string | null
          confirmed_by_name?: string | null
          created_at?: string
          customer_name?: string
          customer_whatsapp?: string
          delivery_city?: string | null
          delivery_method?: string | null
          id?: string
          items?: Json
          order_number?: never
          paid_at?: string | null
          payment_method?: string
          payment_proof_amount?: number | null
          payment_proof_name?: string | null
          payment_proof_path?: string | null
          payment_proof_type?: string | null
          payment_proof_validated_at?: string | null
          payment_proof_validated_total?: number | null
          pickup_document?: string | null
          pickup_name?: string | null
          seller_id?: string | null
          seller_name?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
          van_contact?: string | null
        }
        Relationships: []
      }
      password_reset_attempts: {
        Row: {
          attempted_at: string
          id: string
          whatsapp_digits: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          whatsapp_digits: string
        }
        Update: {
          attempted_at?: string
          id?: string
          whatsapp_digits?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          city: string
          comment: string
          created_at: string
          customer_name: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          order_id: string
          product_id: string
          rating: number
          status: string
          user_id: string
        }
        Insert: {
          city: string
          comment: string
          created_at?: string
          customer_name: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          order_id: string
          product_id: string
          rating: number
          status?: string
          user_id: string
        }
        Update: {
          city?: string
          comment?: string
          created_at?: string
          customer_name?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          order_id?: string
          product_id?: string
          rating?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cadastrado_por: string | null
          category: string
          created_at: string
          description: string
          dimensions: string
          id: string
          image_key: string | null
          image_url: string | null
          imagens: string[]
          max_per_customer: number
          name: string
          price: number
          status: string
          status_aprovacao: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          cadastrado_por?: string | null
          category: string
          created_at?: string
          description: string
          dimensions?: string
          id: string
          image_key?: string | null
          image_url?: string | null
          imagens?: string[]
          max_per_customer?: number
          name: string
          price?: number
          status?: string
          status_aprovacao?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          cadastrado_por?: string | null
          category?: string
          created_at?: string
          description?: string
          dimensions?: string
          id?: string
          image_key?: string | null
          image_url?: string | null
          imagens?: string[]
          max_per_customer?: number
          name?: string
          price?: number
          status?: string
          status_aprovacao?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepts_offers: boolean | null
          birth_date: string | null
          created_at: string
          full_name: string
          id: string
          marketing_opt_in: boolean
          marketing_opt_in_at: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          accepts_offers?: boolean | null
          birth_date?: string | null
          created_at?: string
          full_name: string
          id: string
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          accepts_offers?: boolean | null
          birth_date?: string | null
          created_at?: string
          full_name?: string
          id?: string
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          pode_alterar_status_produtos: boolean
          pode_anexar_pix: boolean
          pode_cadastrar_produtos: boolean
          pode_cancelar_pedidos: boolean
          pode_editar_pedidos: boolean
          pode_enviar_orientacoes_pix: boolean
          pode_ignorar_pedido_minimo: boolean
          pode_ver_todos_pedidos: boolean
          pode_ver_totais_financeiros: boolean
          user_id: string
          username: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          pode_alterar_status_produtos?: boolean
          pode_anexar_pix?: boolean
          pode_cadastrar_produtos?: boolean
          pode_cancelar_pedidos?: boolean
          pode_editar_pedidos?: boolean
          pode_enviar_orientacoes_pix?: boolean
          pode_ignorar_pedido_minimo?: boolean
          pode_ver_todos_pedidos?: boolean
          pode_ver_totais_financeiros?: boolean
          user_id: string
          username: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          pode_alterar_status_produtos?: boolean
          pode_anexar_pix?: boolean
          pode_cadastrar_produtos?: boolean
          pode_cancelar_pedidos?: boolean
          pode_editar_pedidos?: boolean
          pode_enviar_orientacoes_pix?: boolean
          pode_ignorar_pedido_minimo?: boolean
          pode_ver_todos_pedidos?: boolean
          pode_ver_totais_financeiros?: boolean
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_team_permissions: {
        Args: {
          p_pode_alterar_status_produtos: boolean
          p_pode_anexar_pix: boolean
          p_pode_cadastrar_produtos: boolean
          p_pode_cancelar_pedidos: boolean
          p_pode_editar_pedidos: boolean
          p_pode_enviar_orientacoes_pix: boolean
          p_pode_ignorar_pedido_minimo: boolean
          p_pode_ver_todos_pedidos: boolean
          p_pode_ver_totais_financeiros: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      can_submit_product: { Args: never; Returns: boolean }
      cancel_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_name: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          created_at: string
          customer_name: string
          customer_whatsapp: string
          delivery_city: string | null
          delivery_method: string | null
          id: string
          items: Json
          order_number: number
          paid_at: string | null
          payment_method: string
          payment_proof_amount: number | null
          payment_proof_name: string | null
          payment_proof_path: string | null
          payment_proof_type: string | null
          payment_proof_validated_at: string | null
          payment_proof_validated_total: number | null
          pickup_document: string | null
          pickup_name: string | null
          seller_id: string | null
          seller_name: string | null
          status: string
          total: number
          updated_at: string
          user_id: string
          van_contact: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_order: {
        Args: { p_order_id: string }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_name: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          created_at: string
          customer_name: string
          customer_whatsapp: string
          delivery_city: string | null
          delivery_method: string | null
          id: string
          items: Json
          order_number: number
          paid_at: string | null
          payment_method: string
          payment_proof_amount: number | null
          payment_proof_name: string | null
          payment_proof_path: string | null
          payment_proof_type: string | null
          payment_proof_validated_at: string | null
          payment_proof_validated_total: number | null
          pickup_document: string | null
          pickup_name: string | null
          seller_id: string | null
          seller_name: string | null
          status: string
          total: number
          updated_at: string
          user_id: string
          van_contact: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_admin: { Args: never; Returns: boolean }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      update_order_items: {
        Args: { p_items: Json; p_order_id: string }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_name: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          created_at: string
          customer_name: string
          customer_whatsapp: string
          delivery_city: string | null
          delivery_method: string | null
          id: string
          items: Json
          order_number: number
          paid_at: string | null
          payment_method: string
          payment_proof_amount: number | null
          payment_proof_name: string | null
          payment_proof_path: string | null
          payment_proof_type: string | null
          payment_proof_validated_at: string | null
          payment_proof_validated_total: number | null
          pickup_document: string | null
          pickup_name: string | null
          seller_id: string | null
          seller_name: string | null
          status: string
          total: number
          updated_at: string
          user_id: string
          van_contact: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "vendedor"
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
      app_role: ["admin", "vendedor"],
    },
  },
} as const
