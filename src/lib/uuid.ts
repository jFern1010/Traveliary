/**
 * RFC 4122 version 4 UUID. Used for photo IDs generated on the phone so upload retries are idempotent.
 * Math.random is fine here: IDs are not secrets, and the server rejects reuse by another user.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
