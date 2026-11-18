import { describe, expect, it } from 'vitest';
import { catalogImageUrl } from './CatalogApi';

describe('catalogImageUrl', () => {
  it('routes absolute catalog images through the API', () => {
    expect(catalogImageUrl('https://static.flibusta.is/i/1/c.jpg')).toBe(
      '/api/catalog/image?src=https%3A%2F%2Fstatic.flibusta.is%2Fi%2F1%2Fc.jpg',
    );
  });
  it('resolves relative OPDS links against the main host', () => {
    expect(catalogImageUrl('/i/2/c.png')).toBe('/api/catalog/image?src=https%3A%2F%2Fflibusta.is%2Fi%2F2%2Fc.png');
  });
});
