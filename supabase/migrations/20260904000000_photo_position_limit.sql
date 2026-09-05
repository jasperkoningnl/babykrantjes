-- Eén persistente rij per van de vier toegestane fotoposities.
delete from public.paper_photos where position not between 1 and 4 or position is null;
delete from public.paper_photos old
using public.paper_photos newer
where old.paper_id = newer.paper_id and old.position = newer.position
  and (old.uploaded_at, old.id) < (newer.uploaded_at, newer.id);

alter table public.paper_photos
  add constraint paper_photos_position_range check (position between 1 and 4),
  alter column position set not null;

create unique index if not exists paper_photos_paper_position_unique
  on public.paper_photos (paper_id, position);

-- De rijvergrendeling maakt vervangen veilig bij parallelle uploads en geeft het
-- vorige objectpad terug zodat de route ook Storage tot vier objecten kan houden.
create or replace function public.replace_paper_photo(
  target_paper_id uuid,
  target_position integer,
  new_file_path text,
  new_byte_size integer,
  new_width integer,
  new_height integer
)
returns table(photo_id uuid, previous_file_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_photo public.paper_photos%rowtype;
begin
  if target_position not between 1 and 4 then raise exception 'invalid photo position'; end if;
  select * into current_photo from public.paper_photos
    where paper_id = target_paper_id and position = target_position for update;
  if found then
    update public.paper_photos set file_path = new_file_path, mime_type = 'image/webp',
      byte_size = new_byte_size, width = new_width, height = new_height,
      uploaded_at = now()
      where id = current_photo.id;
    return query select current_photo.id, current_photo.file_path;
  else
    insert into public.paper_photos(paper_id, position, file_path, mime_type, byte_size, width, height)
      values(target_paper_id, target_position, new_file_path, 'image/webp', new_byte_size, new_width, new_height)
      returning id into photo_id;
    previous_file_path := null;
    return next;
  end if;
end;
$$;

revoke all on function public.replace_paper_photo(uuid, integer, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.replace_paper_photo(uuid, integer, text, integer, integer, integer) to service_role;
