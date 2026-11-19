import { redirect } from 'next/navigation';
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  redirect('/member/projects/new' + (id && /^[a-f0-9-]{36}$/.test(id) ? '?id=' + id : ''));
}
