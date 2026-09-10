-- CLIMAX Library: unrestricted book access + per-book student download control
alter table public.books add column if not exists allow_download boolean not null default false;
alter table public.books alter column level drop not null;
alter table public.books alter column department drop not null;
do $$ declare r record; begin for r in select conname from pg_constraint where conrelid='public.books'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%department%' and pg_get_constraintdef(oid) ilike '%level%' loop execute format('alter table public.books drop constraint %I',r.conname); end loop; end $$;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname='public' and tablename='books' and cmd='SELECT' loop execute format('drop policy if exists %I on public.books',r.policyname); end loop; end $$;
create policy "admins can view all books" on public.books for select to authenticated using (public.is_admin());
create policy "active students can view all published books" on public.books for select to authenticated using (published=true and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='student' and p.status='active'));
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and cmd='SELECT' and (coalesce(qual,'') ilike '%bucket_id%pdf%' or coalesce(with_check,'') ilike '%bucket_id%pdf%') loop execute format('drop policy if exists %I on storage.objects',r.policyname); end loop; end $$;
create policy "approved users can read published books" on storage.objects for select to authenticated using (bucket_id='pdf' and (public.is_admin() or exists(select 1 from public.books b join public.profiles p on p.id=auth.uid() where b.file_path=storage.objects.name and b.published=true and p.role='student' and p.status='active')));
