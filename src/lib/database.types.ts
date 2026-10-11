
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"target_id": string | null,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookmarks": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookmarks_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookmarks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookmarks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"channels": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"position": number,"server_id": string,"topic": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"position"?: number,"server_id": string,"topic"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"server_id"?: string,"topic"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "channels_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "servers"
      referencedColumns: ["id"]
    }
                  ]
                },"club_members": {
                  Row: {
                    "club_id": string,"created_at": string,"note": string | null,"role": Database["public"]['Enums']["club_member_role"],"status": Database["public"]['Enums']["request_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"note"?: string | null,"role"?: Database["public"]['Enums']["club_member_role"],"status"?: Database["public"]['Enums']["request_status"],"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"note"?: string | null,"role"?: Database["public"]['Enums']["club_member_role"],"status"?: Database["public"]['Enums']["request_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_members_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "category": string,"cover_url": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_official": boolean,"logo": string,"membership_policy": Database["public"]['Enums']["membership_policy"],"name": string,"requirements": string | null,"server_id": string | null,"slug": string,"tagline": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_official"?: boolean,"logo"?: string,"membership_policy"?: Database["public"]['Enums']["membership_policy"],"name": string,"requirements"?: string | null,"server_id"?: string | null,"slug": string,"tagline"?: string | null
                  }
                  Update: {
                    "category"?: string,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_official"?: boolean,"logo"?: string,"membership_policy"?: Database["public"]['Enums']["membership_policy"],"name"?: string,"requirements"?: string | null,"server_id"?: string | null,"slug"?: string,"tagline"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clubs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clubs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clubs_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "servers"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"post_id": string,"shield_state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"post_id": string,"shield_state"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"post_id"?: string,"shield_state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_members": {
                  Row: {
                    "conversation_id": string,"last_read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"last_read_at"?: string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"last_read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_members_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"id": string,"last_message_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"direct_messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "direct_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_registrations": {
                  Row: {
                    "created_at": string,"event_id": string,"reminded": boolean,"status": Database["public"]['Enums']["registration_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"reminded"?: boolean,"status"?: Database["public"]['Enums']["registration_status"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"reminded"?: boolean,"status"?: Database["public"]['Enums']["registration_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_registrations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_registrations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "capacity": number | null,"category": string,"club_id": string | null,"cover_url": string | null,"created_at": string,"description": string | null,"ends_at": string,"id": string,"is_cancelled": boolean,"organizer_id": string,"registration_deadline": string | null,"starts_at": string,"title": string,"venue": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number | null,"category"?: string,"club_id"?: string | null,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at": string,"id"?: string,"is_cancelled"?: boolean,"organizer_id": string,"registration_deadline"?: string | null,"starts_at": string,"title": string,"venue": string
                  }
                  Update: {
                    "capacity"?: number | null,"category"?: string,"club_id"?: string | null,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string,"id"?: string,"is_cancelled"?: boolean,"organizer_id"?: string,"registration_deadline"?: string | null,"starts_at"?: string,"title"?: string,"venue"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_organizer_id_fkey"
      columns: ["organizer_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_organizer_id_fkey"
      columns: ["organizer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"followee_id": string,"follower_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"followee_id": string,"follower_id": string
                  }
                  Update: {
                    "created_at"?: string,"followee_id"?: string,"follower_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_attachments": {
                  Row: {
                    "created_at": string,"id": string,"incident_id": string,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"incident_id": string,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"incident_id"?: string,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_attachments_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incident_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incident_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_updates": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": string,"incident_id": string,"is_internal": boolean,"kind": string,"note": string | null,"to_status": Database["public"]['Enums']["incident_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: string,"incident_id": string,"is_internal"?: boolean,"kind": string,"note"?: string | null,"to_status"?: Database["public"]['Enums']["incident_status"] | null
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: string,"incident_id"?: string,"is_internal"?: boolean,"kind"?: string,"note"?: string | null,"to_status"?: Database["public"]['Enums']["incident_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_updates_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incident_updates_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incident_updates_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"incidents": {
                  Row: {
                    "category": Database["public"]['Enums']["incident_category"],"context": string | null,"created_at": string,"declared_at": string,"department": string,"description": string,"direction": Database["public"]['Enums']["incident_direction"],"id": string,"is_demo": boolean,"location": string | null,"occurred_on": string,"outcome_note": string | null,"ref_code": string,"reporter_id": string,"reviewed_by": string | null,"status": Database["public"]['Enums']["incident_status"],"subject_name": string,"title": string,"updated_at": string,"witnesses": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["incident_category"],"context"?: string | null,"created_at"?: string,"declared_at"?: string,"department": string,"description": string,"direction": Database["public"]['Enums']["incident_direction"],"id"?: string,"is_demo"?: boolean,"location"?: string | null,"occurred_on": string,"outcome_note"?: string | null,"ref_code"?: string,"reporter_id": string,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["incident_status"],"subject_name": string,"title": string,"updated_at"?: string,"witnesses"?: string | null
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["incident_category"],"context"?: string | null,"created_at"?: string,"declared_at"?: string,"department"?: string,"description"?: string,"direction"?: Database["public"]['Enums']["incident_direction"],"id"?: string,"is_demo"?: boolean,"location"?: string | null,"occurred_on"?: string,"outcome_note"?: string | null,"ref_code"?: string,"reporter_id"?: string,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["incident_status"],"subject_name"?: string,"title"?: string,"updated_at"?: string,"witnesses"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "incidents_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incidents_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incidents_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incidents_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "author_id": string,"body": string,"channel_id": string,"created_at": string,"deleted_at": string | null,"edited_at": string | null,"id": string,"reply_to": string | null,"server_id": string,"shield_state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"channel_id": string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"reply_to"?: string | null,"server_id": string,"shield_state"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"channel_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"reply_to"?: string | null,"server_id"?: string,"shield_state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_reply_to_fkey"
      columns: ["reply_to"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "servers"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_appeals": {
                  Row: {
                    "appellant_id": string,"case_id": string,"created_at": string,"id": string,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"statement": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appellant_id": string,"case_id": string,"created_at"?: string,"id"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"statement": string,"status"?: string
                  }
                  Update: {
                    "appellant_id"?: string,"case_id"?: string,"created_at"?: string,"id"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"statement"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_appeals_appellant_id_fkey"
      columns: ["appellant_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_appeals_appellant_id_fkey"
      columns: ["appellant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_appeals_case_id_fkey"
      columns: ["case_id"]
isOneToOne: true
      referencedRelation: "moderation_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_appeals_case_id_fkey"
      columns: ["case_id"]
isOneToOne: true
      referencedRelation: "my_moderation_notices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_appeals_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_appeals_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_cases": {
                  Row: {
                    "category": Database["public"]['Enums']["shield_category"],"content_author_id": string | null,"content_excerpt": string | null,"content_id": string,"content_type": Database["public"]['Enums']["shield_content"],"context": NonNullable<Json>,"created_at": string,"decision": Database["public"]['Enums']["shield_decision"] | null,"decision_reason": string | null,"id": string,"model_explanation": string | null,"model_provider": string | null,"model_scores": Json | null,"pattern_evidence": NonNullable<Json>,"priority": number,"report_count": number,"review_status": Database["public"]['Enums']["shield_case_status"],"reviewed_at": string | null,"reviewed_by": string | null,"risk_level": Database["public"]['Enums']["shield_risk"],"scan_id": string | null,"source": string,"target_user_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: Database["public"]['Enums']["shield_category"],"content_author_id"?: string | null,"content_excerpt"?: string | null,"content_id": string,"content_type": Database["public"]['Enums']["shield_content"],"context"?: NonNullable<Json>,"created_at"?: string,"decision"?: Database["public"]['Enums']["shield_decision"] | null,"decision_reason"?: string | null,"id"?: string,"model_explanation"?: string | null,"model_provider"?: string | null,"model_scores"?: Json | null,"pattern_evidence"?: NonNullable<Json>,"priority"?: number,"report_count"?: number,"review_status"?: Database["public"]['Enums']["shield_case_status"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"risk_level"?: Database["public"]['Enums']["shield_risk"],"scan_id"?: string | null,"source": string,"target_user_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["shield_category"],"content_author_id"?: string | null,"content_excerpt"?: string | null,"content_id"?: string,"content_type"?: Database["public"]['Enums']["shield_content"],"context"?: NonNullable<Json>,"created_at"?: string,"decision"?: Database["public"]['Enums']["shield_decision"] | null,"decision_reason"?: string | null,"id"?: string,"model_explanation"?: string | null,"model_provider"?: string | null,"model_scores"?: Json | null,"pattern_evidence"?: NonNullable<Json>,"priority"?: number,"report_count"?: number,"review_status"?: Database["public"]['Enums']["shield_case_status"],"reviewed_at"?: string | null,"reviewed_by"?: string | null,"risk_level"?: Database["public"]['Enums']["shield_risk"],"scan_id"?: string | null,"source"?: string,"target_user_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_cases_content_author_id_fkey"
      columns: ["content_author_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_cases_content_author_id_fkey"
      columns: ["content_author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_cases_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_cases_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_cases_scan_id_fkey"
      columns: ["scan_id"]
isOneToOne: false
      referencedRelation: "moderation_scans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_cases_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_cases_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_events": {
                  Row: {
                    "actor_id": string | null,"case_id": string,"created_at": string,"details": NonNullable<Json>,"event_type": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"case_id": string,"created_at"?: string,"details"?: NonNullable<Json>,"event_type": string,"id"?: never
                  }
                  Update: {
                    "actor_id"?: string | null,"case_id"?: string,"created_at"?: string,"details"?: NonNullable<Json>,"event_type"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_events_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "moderation_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_events_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "my_moderation_notices"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_jobs": {
                  Row: {
                    "attempts": number,"content_id": string,"content_type": Database["public"]['Enums']["shield_content"],"created_at": string,"id": number,"last_error": string | null,"processed_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"content_id": string,"content_type": Database["public"]['Enums']["shield_content"],"created_at"?: string,"id"?: never,"last_error"?: string | null,"processed_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"content_id"?: string,"content_type"?: Database["public"]['Enums']["shield_content"],"created_at"?: string,"id"?: never,"last_error"?: string | null,"processed_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"moderation_reports": {
                  Row: {
                    "case_id": string | null,"category": string | null,"created_at": string,"id": string,"reason": string,"reporter_id": string,"resolution_note": string | null,"resolved_by": string | null,"status": string,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "case_id"?: string | null,"category"?: string | null,"created_at"?: string,"id"?: string,"reason": string,"reporter_id": string,"resolution_note"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "case_id"?: string | null,"category"?: string | null,"created_at"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_reports_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "moderation_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_reports_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "my_moderation_notices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_scans": {
                  Row: {
                    "content_id": string,"content_type": Database["public"]['Enums']["shield_content"],"created_at": string,"error": string | null,"explanation": string | null,"id": string,"latency_ms": number | null,"mapped_scores": Json | null,"model": string | null,"model_category": Database["public"]['Enums']["shield_category"] | null,"policy_risk": Database["public"]['Enums']["shield_risk"] | null,"provider": string,"provider_flagged": boolean | null,"provider_scores": Json | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_id": string,"content_type": Database["public"]['Enums']["shield_content"],"created_at"?: string,"error"?: string | null,"explanation"?: string | null,"id"?: string,"latency_ms"?: number | null,"mapped_scores"?: Json | null,"model"?: string | null,"model_category"?: Database["public"]['Enums']["shield_category"] | null,"policy_risk"?: Database["public"]['Enums']["shield_risk"] | null,"provider": string,"provider_flagged"?: boolean | null,"provider_scores"?: Json | null,"status": string
                  }
                  Update: {
                    "content_id"?: string,"content_type"?: Database["public"]['Enums']["shield_content"],"created_at"?: string,"error"?: string | null,"explanation"?: string | null,"id"?: string,"latency_ms"?: number | null,"mapped_scores"?: Json | null,"model"?: string | null,"model_category"?: Database["public"]['Enums']["shield_category"] | null,"policy_risk"?: Database["public"]['Enums']["shield_risk"] | null,"provider"?: string,"provider_flagged"?: boolean | null,"provider_scores"?: Json | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"link": string | null,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_likes": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_likes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "author_id": string,"body": string,"club_id": string | null,"created_at": string,"event_id": string | null,"id": string,"image_path": string | null,"is_announcement": boolean,"shield_state": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"club_id"?: string | null,"created_at"?: string,"event_id"?: string | null,"id"?: string,"image_path"?: string | null,"is_announcement"?: boolean,"shield_state"?: string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"club_id"?: string | null,"created_at"?: string,"event_id"?: string | null,"id"?: string,"image_path"?: string | null,"is_announcement"?: boolean,"shield_state"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_club_fk"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_event_fk"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "affiliation": Database["public"]['Enums']["affiliation"],"allow_dms": boolean,"avatar_url": string | null,"bio": string | null,"created_at": string,"department": string | null,"full_name": string,"goals": (string)[],"handle": string,"id": string,"interests": (string)[],"ms_linked_at": string | null,"ms_tenant_id": string | null,"onboarded": boolean,"program": string | null,"skills": (string)[],"updated_at": string,"visibility": Database["public"]['Enums']["profile_visibility"],"year_of_study": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliation"?: Database["public"]['Enums']["affiliation"],"allow_dms"?: boolean,"avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"department"?: string | null,"full_name": string,"goals"?: (string)[],"handle": string,"id": string,"interests"?: (string)[],"ms_linked_at"?: string | null,"ms_tenant_id"?: string | null,"onboarded"?: boolean,"program"?: string | null,"skills"?: (string)[],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["profile_visibility"],"year_of_study"?: number | null
                  }
                  Update: {
                    "affiliation"?: Database["public"]['Enums']["affiliation"],"allow_dms"?: boolean,"avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"department"?: string | null,"full_name"?: string,"goals"?: (string)[],"handle"?: string,"id"?: string,"interests"?: (string)[],"ms_linked_at"?: string | null,"ms_tenant_id"?: string | null,"onboarded"?: boolean,"program"?: string | null,"skills"?: (string)[],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["profile_visibility"],"year_of_study"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"project_private_details": {
                  Row: {
                    "agreement_note": string | null,"budget_note": string | null,"project_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_note"?: string | null,"budget_note"?: string | null,"project_id": string,"updated_at"?: string
                  }
                  Update: {
                    "agreement_note"?: string | null,"budget_note"?: string | null,"project_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_private_details_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "research_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limit_events": {
                  Row: {
                    "action": string,"created_at": string,"id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"id"?: never,"user_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"id"?: never,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rate_limit_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rate_limit_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"research_applications": {
                  Row: {
                    "applicant_id": string,"availability": string | null,"created_at": string,"id": string,"project_id": string,"relevant_skills": (string)[],"reviewer_note": string | null,"statement": string,"status": Database["public"]['Enums']["application_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_id": string,"availability"?: string | null,"created_at"?: string,"id"?: string,"project_id": string,"relevant_skills"?: (string)[],"reviewer_note"?: string | null,"statement": string,"status"?: Database["public"]['Enums']["application_status"],"updated_at"?: string
                  }
                  Update: {
                    "applicant_id"?: string,"availability"?: string | null,"created_at"?: string,"id"?: string,"project_id"?: string,"relevant_skills"?: (string)[],"reviewer_note"?: string | null,"statement"?: string,"status"?: Database["public"]['Enums']["application_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "research_applications_applicant_id_fkey"
      columns: ["applicant_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "research_applications_applicant_id_fkey"
      columns: ["applicant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "research_applications_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "research_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"research_projects": {
                  Row: {
                    "abstract": string,"area": string,"commitment": string,"created_at": string,"department": string | null,"description": string | null,"id": string,"kind": Database["public"]['Enums']["project_kind"],"lead_id": string,"open_to": (string)[],"positions": number,"required_skills": (string)[],"status": Database["public"]['Enums']["project_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abstract": string,"area": string,"commitment": string,"created_at"?: string,"department"?: string | null,"description"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["project_kind"],"lead_id": string,"open_to"?: (string)[],"positions"?: number,"required_skills"?: (string)[],"status"?: Database["public"]['Enums']["project_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "abstract"?: string,"area"?: string,"commitment"?: string,"created_at"?: string,"department"?: string | null,"description"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["project_kind"],"lead_id"?: string,"open_to"?: (string)[],"positions"?: number,"required_skills"?: (string)[],"status"?: Database["public"]['Enums']["project_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "research_projects_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "research_projects_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"server_invites": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string,"expires_at": string,"id": string,"max_uses": number,"server_id": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string,"created_at"?: string,"created_by": string,"expires_at"?: string,"id"?: string,"max_uses"?: number,"server_id": string,"uses"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"id"?: string,"max_uses"?: number,"server_id"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "server_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "server_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "server_invites_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "servers"
      referencedColumns: ["id"]
    }
                  ]
                },"server_join_requests": {
                  Row: {
                    "created_at": string,"decided_by": string | null,"message": string | null,"server_id": string,"status": Database["public"]['Enums']["request_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_by"?: string | null,"message"?: string | null,"server_id": string,"status"?: Database["public"]['Enums']["request_status"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_by"?: string | null,"message"?: string | null,"server_id"?: string,"status"?: Database["public"]['Enums']["request_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "server_join_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "server_join_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "server_join_requests_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "server_join_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "server_join_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"server_members": {
                  Row: {
                    "joined_at": string,"role": Database["public"]['Enums']["server_role"],"server_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["server_role"],"server_id": string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["server_role"],"server_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "server_members_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "server_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "server_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"servers": {
                  Row: {
                    "category": string,"cover_url": string | null,"created_at": string,"description": string | null,"icon": string,"id": string,"name": string,"owner_id": string,"visibility": Database["public"]['Enums']["server_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"name": string,"owner_id": string,"visibility"?: Database["public"]['Enums']["server_visibility"]
                  }
                  Update: {
                    "category"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"visibility"?: Database["public"]['Enums']["server_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "servers_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "servers_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string,"kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string,"kind"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string,"kind"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_restrictions": {
                  Row: {
                    "case_id": string | null,"created_at": string,"created_by": string | null,"ends_at": string,"id": string,"kind": string,"lifted_at": string | null,"lifted_by": string | null,"reason": string,"starts_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "case_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"kind"?: string,"lifted_at"?: string | null,"lifted_by"?: string | null,"reason": string,"starts_at"?: string,"user_id": string
                  }
                  Update: {
                    "case_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"kind"?: string,"lifted_at"?: string | null,"lifted_by"?: string | null,"reason"?: string,"starts_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_restrictions_case_fk"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "moderation_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_restrictions_case_fk"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "my_moderation_notices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_restrictions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_restrictions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_restrictions_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_restrictions_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_restrictions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_restrictions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "incident_timeline": {
                  Row: {
                    "actor_label": string | null,"created_at": string | null,"id": string | null,"incident_id": string | null,"is_internal": boolean | null,"kind": string | null,"note": string | null,"to_status": Database["public"]['Enums']["incident_status"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "incident_updates_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"my_moderation_notices": {
                  Row: {
                    "appeal_resolution": string | null,"appeal_status": string | null,"category": Database["public"]['Enums']["shield_category"] | null,"content_excerpt": string | null,"content_id": string | null,"content_state": string | null,"content_type": Database["public"]['Enums']["shield_content"] | null,"created_at": string | null,"decision": Database["public"]['Enums']["shield_decision"] | null,"decision_reason": string | null,"id": string | null,"review_status": Database["public"]['Enums']["shield_case_status"] | null,"reviewed_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"profile_cards": {
                  Row: {
                    "affiliation": Database["public"]['Enums']["affiliation"] | null,"allow_dms": boolean | null,"avatar_url": string | null,"bio": string | null,"created_at": string | null,"department": string | null,"full_name": string | null,"goals": (string)[] | null,"handle": string | null,"id": string | null,"interests": (string)[] | null,"ms_tenant_id": string | null,"program": string | null,"skills": (string)[] | null,"visibility": Database["public"]['Enums']["profile_visibility"] | null,"year_of_study": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "affiliation"?: Database["public"]['Enums']["affiliation"] | null,"allow_dms"?: boolean | null,"avatar_url"?: string | null,"bio"?: never,"created_at"?: string | null,"department"?: never,"full_name"?: string | null,"goals"?: never,"handle"?: string | null,"id"?: string | null,"interests"?: never,"ms_tenant_id"?: string | null,"program"?: never,"skills"?: never,"visibility"?: Database["public"]['Enums']["profile_visibility"] | null,"year_of_study"?: never
                         }
                        Update: {
                           "affiliation"?: Database["public"]['Enums']["affiliation"] | null,"allow_dms"?: boolean | null,"avatar_url"?: string | null,"bio"?: never,"created_at"?: string | null,"department"?: never,"full_name"?: string | null,"goals"?: never,"handle"?: string | null,"id"?: string | null,"interests"?: never,"ms_tenant_id"?: string | null,"program"?: never,"skills"?: never,"visibility"?: Database["public"]['Enums']["profile_visibility"] | null,"year_of_study"?: never
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_set_role":
{ Args: { "p_grant": boolean,"p_role": Database["public"]['Enums']["app_role"],"p_user": string }; Returns: undefined
                           },
"apply_to_project":
{ Args: { "p_availability": string,"p_skills": (string)[],"p_statement": string,"pid": string }; Returns: string
                           },
"audit":
{ Args: { "p_action": string,"p_details"?: Json,"p_target_id": string,"p_target_type": string }; Returns: undefined
                           },
"can_manage_event":
{ Args: { "eid": string }; Returns: boolean
                           },
"can_read_server":
{ Args: { "sid": string }; Returns: boolean
                           },
"can_review_incident":
{ Args: { "p_department": string }; Returns: boolean
                           },
"can_view_profile":
{ Args: { "target": string }; Returns: boolean
                           },
"cancel_event_registration":
{ Args: { "eid": string }; Returns: undefined
                           },
"check_rate_limit":
{ Args: { "p_action": string,"p_max": number,"p_window": string }; Returns: undefined
                           },
"decide_club_member":
{ Args: { "cid": string,"p_approve": boolean,"p_user": string }; Returns: undefined
                           },
"decide_server_request":
{ Args: { "p_approve": boolean,"p_user": string,"sid": string }; Returns: undefined
                           },
"event_counts":
{ Args: { "ids": (string)[] }; Returns: {
              "event_id": string,"registered": number
            }[]
                           },
"global_search":
{ Args: { "q": string }; Returns: {
              "href": string,"id": string,"kind": string,"subtitle": string,"title": string
            }[]
                           },
"has_role":
{ Args: { "r": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"incident_add_note":
{ Args: { "p_id": string,"p_internal"?: boolean,"p_note": string }; Returns: undefined
                           },
"incident_can_transition":
{ Args: { "from_s": Database["public"]['Enums']["incident_status"],"to_s": Database["public"]['Enums']["incident_status"] }; Returns: boolean
                           },
"incident_submit":
{ Args: { "p_category": Database["public"]['Enums']["incident_category"],"p_context": string,"p_declaration": boolean,"p_department": string,"p_description": string,"p_location": string,"p_occurred_on": string,"p_subject_name": string,"p_title": string,"p_witnesses": string }; Returns: string
                           },
"incident_transition":
{ Args: { "p_id": string,"p_note"?: string,"p_to": Database["public"]['Enums']["incident_status"] }; Returns: undefined
                           },
"incident_withdraw":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked_between":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"is_club_coordinator":
{ Args: { "cid": string }; Returns: boolean
                           },
"is_conversation_member":
{ Args: { "cid": string }; Returns: boolean
                           },
"is_following":
{ Args: { "target": string }; Returns: boolean
                           },
"is_moderator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_posting_restricted":
{ Args: { "uid": string }; Returns: boolean
                           },
"is_server_member":
{ Args: { "sid": string }; Returns: boolean
                           },
"is_server_staff":
{ Args: { "sid": string }; Returns: boolean
                           },
"join_club":
{ Args: { "cid": string,"p_note"?: string }; Returns: Database["public"]['Enums']["request_status"]
                           },
"join_public_server":
{ Args: { "sid": string }; Returns: undefined
                           },
"mod_resolve_report":
{ Args: { "p_id": string,"p_note"?: string,"p_remove_content"?: boolean,"p_status": string }; Returns: undefined
                           },
"moderate_delete_message":
{ Args: { "mid": string }; Returns: undefined
                           },
"notify":
{ Args: { "p_body"?: string,"p_link"?: string,"p_title": string,"p_type": string,"p_user": string }; Returns: undefined
                           },
"redact_sensitive":
{ Args: { "t": string }; Returns: string
                           },
"redeem_server_invite":
{ Args: { "p_code": string }; Returns: string
                           },
"register_for_event":
{ Args: { "eid": string }; Returns: undefined
                           },
"remove_server_member":
{ Args: { "p_user": string,"sid": string }; Returns: undefined
                           },
"request_server_access":
{ Args: { "p_message"?: string,"sid": string }; Returns: undefined
                           },
"review_application":
{ Args: { "aid": string,"p_note"?: string,"p_status": Database["public"]['Enums']["application_status"] }; Returns: undefined
                           },
"search_people":
{ Args: { "p_affiliation"?: Database["public"]['Enums']["affiliation"],"p_department"?: string,"p_interest"?: string,"p_limit"?: number,"q"?: string }; Returns: {
              "affiliation": Database["public"]['Enums']["affiliation"] | null,
"allow_dms": boolean | null,
"avatar_url": string | null,
"bio": string | null,
"created_at": string | null,
"department": string | null,
"full_name": string | null,
"goals": (string)[] | null,
"handle": string | null,
"id": string | null,
"interests": (string)[] | null,
"ms_tenant_id": string | null,
"program": string | null,
"skills": (string)[] | null,
"visibility": Database["public"]['Enums']["profile_visibility"] | null,
"year_of_study": number | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "profile_cards"
        isOneToOne: false
        isSetofReturn: true
      } },
"send_event_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"server_role_of":
{ Args: { "sid": string }; Returns: Database["public"]['Enums']["server_role"]
                           },
"set_club_coordinator":
{ Args: { "cid": string,"p_coordinator": boolean,"p_user": string }; Returns: undefined
                           },
"set_server_member_role":
{ Args: { "p_role": Database["public"]['Enums']["server_role"],"p_user": string,"sid": string }; Returns: undefined
                           },
"shield_add_note":
{ Args: { "p_case": string,"p_note": string }; Returns: undefined
                           },
"shield_appeal":
{ Args: { "p_case": string,"p_statement": string }; Returns: string
                           },
"shield_content_facts":
{ Args: { "p_id": string,"p_type": Database["public"]['Enums']["shield_content"] }; Returns: {
              "author_id": string,"context": Json,"excerpt": string,"target_id": string
            }[]
                           },
"shield_decide":
{ Args: { "p_case": string,"p_decision": Database["public"]['Enums']["shield_decision"],"p_internal_note"?: string,"p_reason"?: string,"p_restrict_days"?: number }; Returns: undefined
                           },
"shield_draft_quota":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"shield_ingest_scan":
{ Args: { "p_category": Database["public"]['Enums']["shield_category"],"p_error": string,"p_explanation": string,"p_flagged": boolean,"p_id": string,"p_latency": number,"p_mapped": Json,"p_model": string,"p_provider": string,"p_provider_scores": Json,"p_risk": Database["public"]['Enums']["shield_risk"],"p_status": string,"p_type": Database["public"]['Enums']["shield_content"] }; Returns: Json
                           },
"shield_lift_restriction":
{ Args: { "p_id": string }; Returns: undefined
                           },
"shield_mark_in_review":
{ Args: { "p_case": string }; Returns: undefined
                           },
"shield_notify_moderators":
{ Args: { "p_admins_only"?: boolean,"p_body": string,"p_case": string,"p_title": string }; Returns: undefined
                           },
"shield_purge":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"shield_resolve_appeal":
{ Args: { "p_appeal": string,"p_overturn": boolean,"p_resolution": string }; Returns: undefined
                           },
"shield_risk_weight":
{ Args: { "r": Database["public"]['Enums']["shield_risk"] }; Returns: number
                           },
"shield_set_content_state":
{ Args: { "p_id": string,"p_state": string,"p_type": Database["public"]['Enums']["shield_content"] }; Returns: undefined
                           },
"start_conversation":
{ Args: { "p_other": string }; Returns: string
                           },
"transfer_server_ownership":
{ Args: { "p_user": string,"sid": string }; Returns: undefined
                           },
"withdraw_application":
{ Args: { "aid": string }; Returns: undefined
                           }
          }
          Enums: {
            "affiliation": "ug_student"|"pg_student"|"phd_scholar"|"faculty"|"staff","app_role": "platform_admin"|"incident_reviewer"|"moderator"|"faculty","application_status": "pending"|"shortlisted"|"accepted"|"rejected"|"withdrawn","club_member_role": "member"|"coordinator","incident_category": "harassment"|"sexual_harassment"|"verbal_abuse"|"discrimination"|"threat_or_violence"|"unprofessional_conduct"|"academic_misconduct"|"other","incident_direction": "about_staff"|"about_student","incident_status": "submitted"|"under_review"|"action_taken"|"unsubstantiated"|"false_report"|"withdrawn","membership_policy": "open"|"approval","profile_visibility": "campus"|"connections"|"hidden","project_kind": "research"|"consultancy","project_status": "open"|"closed"|"completed","registration_status": "registered"|"cancelled","request_status": "pending"|"approved"|"rejected","server_role": "owner"|"moderator"|"member","server_visibility": "public"|"private","shield_case_status": "open"|"in_review"|"escalated"|"resolved"|"dismissed","shield_category": "targeted_harassment"|"repeated_bullying"|"threats_intimidation"|"hate_discrimination"|"sexual_harassment"|"doxxing"|"other_harmful"|"none","shield_content": "post"|"comment"|"message"|"direct_message","shield_decision": "no_action"|"dismissed_false_positive"|"warning"|"edit_requested"|"removed"|"restricted"|"escalated","shield_risk": "low"|"review"|"high"|"critical"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "affiliation": ["ug_student", "pg_student", "phd_scholar", "faculty", "staff"],"app_role": ["platform_admin", "incident_reviewer", "moderator", "faculty"],"application_status": ["pending", "shortlisted", "accepted", "rejected", "withdrawn"],"club_member_role": ["member", "coordinator"],"incident_category": ["harassment", "sexual_harassment", "verbal_abuse", "discrimination", "threat_or_violence", "unprofessional_conduct", "academic_misconduct", "other"],"incident_direction": ["about_staff", "about_student"],"incident_status": ["submitted", "under_review", "action_taken", "unsubstantiated", "false_report", "withdrawn"],"membership_policy": ["open", "approval"],"profile_visibility": ["campus", "connections", "hidden"],"project_kind": ["research", "consultancy"],"project_status": ["open", "closed", "completed"],"registration_status": ["registered", "cancelled"],"request_status": ["pending", "approved", "rejected"],"server_role": ["owner", "moderator", "member"],"server_visibility": ["public", "private"],"shield_case_status": ["open", "in_review", "escalated", "resolved", "dismissed"],"shield_category": ["targeted_harassment", "repeated_bullying", "threats_intimidation", "hate_discrimination", "sexual_harassment", "doxxing", "other_harmful", "none"],"shield_content": ["post", "comment", "message", "direct_message"],"shield_decision": ["no_action", "dismissed_false_positive", "warning", "edit_requested", "removed", "restricted", "escalated"],"shield_risk": ["low", "review", "high", "critical"]
          }
        }
} as const
