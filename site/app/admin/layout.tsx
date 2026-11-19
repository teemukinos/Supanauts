import type {ReactNode} from 'react';
import OrganizerAccess from './organizer-access';
import '../account.css';

export default function AdminLayout({children}: {children: ReactNode}) {
  return <OrganizerAccess>{children}</OrganizerAccess>;
}
