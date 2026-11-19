import { notFound } from 'next/navigation';
import AdminScreen from '../../../components/app/admin-screen';
const sections = [
  'projects',
  'events',
  'updates',
  'imports',
  'codes',
  'settings',
  'shares',
  'notifications',
  'reports',
  'activity',
  'rewards',
];
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <AdminScreen section={section} />;
}
