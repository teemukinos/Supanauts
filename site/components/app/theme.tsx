'use client';
import { useEffect, useState } from 'react';
import { Sun } from 'lucide-react';
export const themeScript = `try{var t=localStorage.getItem('supanauts-theme')||'system';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;}catch{document.documentElement.dataset.theme='dark';}`;
export function ThemePicker() {
  const [theme, setTheme] = useState('system');
  useEffect(() => {
    try {
      setTheme(localStorage.getItem('supanauts-theme') || 'system');
    } catch {}
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      let value = 'system';
      try {
        value = localStorage.getItem('supanauts-theme') || 'system';
      } catch {}
      setTheme(value);
      document.documentElement.dataset.theme =
        value === 'system' ? (media.matches ? 'dark' : 'light') : value;
    };
    media.addEventListener('change', apply);
    window.addEventListener('storage', apply);
    window.addEventListener('appearancechange', apply);
    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('storage', apply);
      window.removeEventListener('appearancechange', apply);
    };
  }, []);
  return (
    <label className="theme-picker">
      <Sun size={16} aria-hidden="true" />
      <span className="sr-only">Appearance</span>
      <select
        aria-label="Appearance"
        value={theme}
        onChange={(e) => {
          const value = e.target.value;
          setTheme(value);
          try {
            localStorage.setItem('supanauts-theme', value);
          } catch {}
          document.documentElement.dataset.theme =
            value === 'system'
              ? matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : value;
          window.dispatchEvent(new Event('appearancechange'));
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
