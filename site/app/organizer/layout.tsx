import type { ReactNode } from 'react';
import Access from '../admin/organizer-access';
export default function Layout({ children }: { children: ReactNode }) {
  return <Access>{children}</Access>;
}
