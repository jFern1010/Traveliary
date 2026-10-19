import { APP_NAME, LEGAL_VERSION, SUPPORT_EMAIL } from '@/constants/app-info';

// Plain-language drafts for the private beta. Have them reviewed before the public store release.

export type LegalDoc = 'terms' | 'privacy';
export type LegalSection = { heading: string; body: string };

export const LEGAL_TITLES: Record<LegalDoc, string> = {
  terms: 'Terms of Use',
  privacy: 'Privacy Policy',
};

export const LEGAL_CONTENT: Record<LegalDoc, LegalSection[]> = {
  terms: [
    {
      heading: 'The short version',
      body: `${APP_NAME} lets you post photos taken where you are, so other travelers can see who has visited a place. Posts are public. Be respectful, and only post what you have the right to share.`,
    },
    {
      heading: 'Zero tolerance for abusive content',
      body: 'You may not post content that is sexual, violent, hateful, harassing, illegal, or that shows someone in a private situation without their consent. You may not use the app to spam or advertise. We remove such content and may block the travelers who post it.',
    },
    {
      heading: 'Reporting and blocking',
      body: 'Anyone can report a photo. A reported photo is hidden for the reporter right away and for everyone once several travelers report it. You can also block a traveler, which hides all of their photos from you. We review reports regularly.',
    },
    {
      heading: 'Your photos',
      body: `You keep ownership of your photos. By posting, you allow ${APP_NAME} to store, display, and distribute them within the app. You can delete any of your photos at any time, or delete all your data from the About screen.`,
    },
    {
      heading: 'No account, anonymous identity',
      body: 'The app creates an anonymous identity on your phone. If you delete the app or change phones, that identity cannot be recovered, and you will no longer be able to manage the photos you posted.',
    },
    {
      heading: 'Beta software',
      body: `${APP_NAME} is in beta and provided “as is”. Features may change, and data may occasionally be lost. We may suspend or end the service.`,
    },
    {
      heading: 'Contact',
      body: `Questions or problems: ${SUPPORT_EMAIL}`,
    },
  ],
  privacy: [
    {
      heading: 'What we collect',
      body: [
        '• Photos you choose to post, resized, with camera metadata removed.',
        '• The exact GPS position where each photo was taken, and the place name.',
        '• A random anonymous ID for your install. No name, email, or phone number.',
        '• If you allow notifications, a push token for your device.',
        '• Your reports and blocks.',
      ].join('\n'),
    },
    {
      heading: 'What others can see',
      body: 'Other travelers see your photos, the place name (for example “Zermatt, Switzerland”), and the date. They never see your exact position or anything that identifies you or your device.',
    },
    {
      heading: 'How we use it',
      body: 'To show photos on the map and in place galleries, to notify you when someone posts at a place you have been, and to keep the app safe (reports, blocks, abuse prevention). No ads, no selling of data, no tracking across other apps.',
    },
    {
      heading: 'Where it is stored',
      body: 'Data is stored with Supabase (database and file hosting). Push notifications are delivered through Expo and Apple or Google. Place names are looked up on your phone using the phone’s built-in map services.',
    },
    {
      heading: 'Must-see suggestions',
      body: 'To suggest well-known places near you, the app sends a rough area (about 10 km wide, never your exact position) and your language to our server, which looks them up on Wikipedia and Wikidata. When you open a place, its summary and photo load directly from Wikipedia and Wikimedia Commons.',
    },
    {
      heading: 'How long we keep it',
      body: 'Until you delete it. Deleting a photo removes it and its files. “Delete my data” in the About screen permanently removes all your photos, reports, blocks, push token, and anonymous identity.',
    },
    {
      heading: 'Children',
      body: `${APP_NAME} is not intended for children under 13.`,
    },
    {
      heading: 'Contact',
      body: `Privacy questions or requests: ${SUPPORT_EMAIL}. Last updated ${LEGAL_VERSION}.`,
    },
  ],
};
