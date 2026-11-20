'use client';
import { useEffect, useState } from 'react';
import { request } from './ui';
export type UploadPolicy = { imageMaxBytes: number; videoMaxBytes: number };
export function useUploadPolicy() {
  const [policy, setPolicy] = useState<UploadPolicy>({ imageMaxBytes: 4000000, videoMaxBytes: 0 });
  useEffect(() => {
    let active = true;
    request<UploadPolicy>('/api/uploads')
      .then((p) => {
        if (active) setPolicy(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return policy;
}
export function uploadHelp(policy: UploadPolicy) {
  return (
    `JPEG, PNG or WebP, up to ${Math.floor(policy.imageMaxBytes / 1000000)} MB each. ` +
    (policy.videoMaxBytes
      ? `MP4 up to ${Math.floor(policy.videoMaxBytes / 1000000)} MB and 90 seconds.`
      : 'For video, add a demo or resource link.')
  );
}
export async function uploadMedia(
  file: File,
  policy: UploadPolicy,
  progress: (value: number) => void,
  eventId?: string,
) {
  const video = file.type === 'video/mp4';
  if (!video && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error('Choose a JPEG, PNG or WebP image.');
  if (video && !policy.videoMaxBytes)
    throw Error('Video uploads are unavailable. Add a demo or resource link instead.');
  const limit = video ? policy.videoMaxBytes : policy.imageMaxBytes;
  if (file.size > limit) throw Error(`Choose a file no larger than ${Math.floor(limit / 1000000)} MB.`);
  const form = new FormData();
  form.set('file', file);
  return new Promise<{ id: string; mime: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/uploads' + (eventId ? '?event=' + encodeURIComponent(eventId) : ''));
    xhr.timeout = 300000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(Error('Upload interrupted. Check your connection and retry this file.'));
    xhr.ontimeout = () => reject(Error('Upload timed out. Retry with a smaller file.'));
    xhr.onload = () => {
      if (xhr.status === 401) window.dispatchEvent(new Event('sessionchange'));
      if (xhr.status === 413)
        return reject(Error('This file is too large to upload. Choose a smaller file.'));
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        return reject(Error('Upload failed. Please retry this file.'));
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof result.id === 'string') resolve(result);
      else reject(Error(result.error || 'Upload failed. Please retry this file.'));
    };
    xhr.send(form);
  });
}
