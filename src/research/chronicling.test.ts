import { describe, expect, it } from 'vitest';
import { altoToText, altoUrlFrom } from './chronicling';

describe('altoToText', () => {
  it('extracts words from ALTO String tags', () => {
    const xml = '<String CONTENT="Gradient"/><String CONTENT="descent"/>';
    expect(altoToText(xml)).toBe('Gradient descent');
  });

  it('rejoins hyphenated words and drops the second half', () => {
    const xml =
      '<String SUBS_TYPE="HypPart1" SUBS_CONTENT="photosynthesis" CONTENT="photo"/>' +
      '<String SUBS_TYPE="HypPart2" SUBS_CONTENT="photosynthesis" CONTENT="synthesis"/>';
    expect(altoToText(xml)).toBe('photosynthesis');
  });

  it('decodes XML entities', () => {
    expect(altoToText('<String CONTENT="R&amp;D"/>')).toBe('R&D');
  });
});

describe('altoUrlFrom', () => {
  it('derives the storage-service XML url from a IIIF image id', () => {
    const img = 'https://tile.loc.gov/image-services/iiif/service:ndnp:batch:1/full/full/0/default.jpg';
    expect(altoUrlFrom(img)).toBe('https://tile.loc.gov/storage-services/service/ndnp/batch/1.xml');
  });
  it('returns null when there is no IIIF id', () => {
    expect(altoUrlFrom('https://example.com/plain.jpg')).toBeNull();
    expect(altoUrlFrom(undefined)).toBeNull();
  });
});
