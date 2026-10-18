import {
  buildMessages,
  chunk,
  deadTokens,
} from '../supabase/functions/notify-new-photo/messages';

const recipients = [
  { expo_token: 'ExponentPushToken[a]', place_id: 'p1', place_name: 'Zermatt' },
  { expo_token: 'ExponentPushToken[b]', place_id: 'p1', place_name: 'Zermatt' },
];

describe('buildMessages', () => {
  it('names the place and carries its id for tap-to-open', () => {
    const [first] = buildMessages(recipients);
    expect(first).toMatchObject({
      to: 'ExponentPushToken[a]',
      title: 'New photo in Zermatt',
      data: { placeId: 'p1' },
      channelId: 'new-photos',
    });
  });
});

describe('chunk', () => {
  it('splits into batches of at most the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe('deadTokens', () => {
  it('returns tokens whose ticket says DeviceNotRegistered', () => {
    const messages = buildMessages(recipients);
    const response = {
      data: [
        { status: 'ok', id: 'x' },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
      ],
    };
    expect(deadTokens(messages, response)).toEqual(['ExponentPushToken[b]']);
  });

  it('ignores other errors and malformed responses', () => {
    const messages = buildMessages(recipients);
    expect(deadTokens(messages, { data: [{ status: 'error', details: { error: 'MessageRateExceeded' } }] })).toEqual([]);
    expect(deadTokens(messages, null)).toEqual([]);
    expect(deadTokens(messages, { errors: [] })).toEqual([]);
  });
});
