import { notFound } from 'next/navigation';
import Organizer from '../../../../components/app/organizer';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  return <Organizer id={id} />;
}
