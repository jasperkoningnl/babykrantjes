import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { NewsStyleExample } from '@/lib/newsStylePrompt'

export async function loadNewsStyleExamples(): Promise<NewsStyleExample[]> {
  const { data, error } = await getSupabaseAdmin().from('news_style_examples')
    .select('id,title,news_date,body,style_note').order('sort_order').limit(5)
  if (error) throw new Error('Voorbeeldartikelen zijn tijdelijk niet beschikbaar')
  return data || []
}
