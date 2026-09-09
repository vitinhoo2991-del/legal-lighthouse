-- Etapa 08 — Documentos + IA
create type public.document_processing_status as enum ('aguardando','processando','processado','falha','requer_ocr');
create type public.document_analysis_status as enum ('nao_analisado','analisando','analisado','falha');
create type public.document_analysis_kind as enum ('analise','pergunta');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  storage_path text not null unique,
  original_name text not null,
  name text not null,
  extension text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum text,
  category text not null default 'outros',
  description text,
  lead_id uuid references public.leads(id),
  contact_id uuid references public.whatsapp_contacts(id),
  opportunity_id uuid references public.crm_opportunities(id),
  conversation_id uuid references public.whatsapp_conversations(id),
  process_reference text,
  uploaded_by uuid references public.profiles(id),
  processing_status public.document_processing_status not null default 'aguardando',
  processing_error text,
  analysis_status public.document_analysis_status not null default 'nao_analisado',
  page_count integer,
  char_count integer,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_office_created_idx on public.documents(office_id, created_at desc);
create index documents_office_category_idx on public.documents(office_id, category);
create index documents_office_status_idx on public.documents(office_id, processing_status);
create index documents_office_analysis_idx on public.documents(office_id, analysis_status);
create index documents_lead_idx on public.documents(lead_id) where lead_id is not null;
create index documents_contact_idx on public.documents(contact_id) where contact_id is not null;
create index documents_opportunity_idx on public.documents(opportunity_id) where opportunity_id is not null;
create index documents_conversation_idx on public.documents(conversation_id) where conversation_id is not null;
create index documents_deleted_idx on public.documents(office_id) where deleted_at is null;

grant select, insert, update on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;

create policy documents_select on public.documents for select to authenticated
  using (office_id = public.current_office_id());
create policy documents_insert on public.documents for insert to authenticated
  with check (office_id = public.current_office_id());
create policy documents_update on public.documents for update to authenticated
  using (office_id = public.current_office_id())
  with check (office_id = public.current_office_id());

create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- Texto extraído (separado da listagem por performance e privacidade)
create table public.document_texts (
  document_id uuid primary key references public.documents(id) on delete cascade,
  office_id uuid not null references public.offices(id),
  content text not null,
  pages jsonb not null default '[]'::jsonb,
  char_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index document_texts_office_idx on public.document_texts(office_id);
grant select, insert, update, delete on public.document_texts to authenticated;
grant all on public.document_texts to service_role;
alter table public.document_texts enable row level security;
create policy document_texts_select on public.document_texts for select to authenticated
  using (office_id = public.current_office_id());
create policy document_texts_insert on public.document_texts for insert to authenticated
  with check (office_id = public.current_office_id());
create policy document_texts_update on public.document_texts for update to authenticated
  using (office_id = public.current_office_id()) with check (office_id = public.current_office_id());
create policy document_texts_delete on public.document_texts for delete to authenticated
  using (office_id = public.current_office_id());

-- Histórico de análises de IA
create table public.document_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  document_id uuid not null references public.documents(id) on delete cascade,
  kind public.document_analysis_kind not null default 'analise',
  question text,
  requested_by uuid references public.profiles(id),
  model text not null,
  prompt_version text,
  status text not null default 'processando',
  result jsonb,
  answer text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  duration_ms integer,
  estimated_cost numeric,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index document_ai_analyses_doc_idx on public.document_ai_analyses(document_id, created_at desc);
create index document_ai_analyses_office_idx on public.document_ai_analyses(office_id, created_at desc);
grant select, insert, update on public.document_ai_analyses to authenticated;
grant all on public.document_ai_analyses to service_role;
alter table public.document_ai_analyses enable row level security;
create policy document_ai_analyses_select on public.document_ai_analyses for select to authenticated
  using (office_id = public.current_office_id());
create policy document_ai_analyses_insert on public.document_ai_analyses for insert to authenticated
  with check (office_id = public.current_office_id());
create policy document_ai_analyses_update on public.document_ai_analyses for update to authenticated
  using (office_id = public.current_office_id()) with check (office_id = public.current_office_id());

-- Vínculo opcional de análise em ai_usage_logs (custos por documento)
alter table public.ai_usage_logs add column if not exists document_id uuid references public.documents(id);

-- Storage privado: cada arquivo vive sob <office_id>/...
create policy documents_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_office_id()::text);
create policy documents_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_office_id()::text);
create policy documents_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_office_id()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_office_id()::text);
create policy documents_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_office_id()::text);