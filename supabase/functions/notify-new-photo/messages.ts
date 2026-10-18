// Pure helpers (no Deno or npm imports) so they can be unit-tested with Jest from the app repo.

export type Recipient = { expo_token: string; place_id: string; place_name: string };

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  /** Android notification channel created by the app (ignored on iOS). */
  channelId: string;
  data: { placeId: string };
};

/** Must match NEW_PHOTOS_CHANNEL_ID in src/features/notifications/register.ts. */
export const ANDROID_CHANNEL_ID = 'new-photos';

/** Expo's push API accepts at most 100 messages per request. */
export const EXPO_BATCH_SIZE = 100;

export function buildMessages(recipients: Recipient[]): ExpoMessage[] {
  return recipients.map((r) => ({
    to: r.expo_token,
    title: `New photo in ${r.place_name}`,
    body: 'A traveler just posted at a place you’ve been. Tap to see it.',
    sound: 'default',
    channelId: ANDROID_CHANNEL_ID,
    data: { placeId: r.place_id },
  }));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

/** Tokens Expo says are dead (app removed or notifications revoked); they should be forgotten. */
export function deadTokens(messages: ExpoMessage[], response: unknown): string[] {
  const tickets = (response as { data?: Ticket[] } | null)?.data;
  if (!Array.isArray(tickets)) return [];
  return tickets.flatMap((ticket, i) =>
    ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && messages[i]
      ? [messages[i].to]
      : [],
  );
}
