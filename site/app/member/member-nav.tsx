'use client';
import {usePathname} from 'next/navigation';
export default function MemberNav() {
  const path = usePathname();
  return <nav className="member-navigation" aria-label="My account navigation">
    {[['/member', 'My codes & activity'], ['/member/profile', 'Profile & preferences'], ['/member/community', 'Community channels']].map(([href, label]) => <a key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</a>)}
  </nav>;
}
