import 'server-only';
// Invitation URLs are private configuration, never client bundles or repository assets.
export const communityDefaults = {
 community: process.env.WHATSAPP_COMMUNITY_URL || '',
};
