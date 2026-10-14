const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Development helper: asks the Expo Push Service to send a notification to this device.
 * In the real app, pushes are sent by the backend (M5), never by the client.
 */
export async function sendTestPush(token: string): Promise<string> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: 'Traveliary',
      body: 'Push works! Someone just posted at a place you visited.',
    }),
  });
  const json: unknown = await response.json();
  return JSON.stringify(json);
}
