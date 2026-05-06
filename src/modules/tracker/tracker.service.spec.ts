import { TrackerService } from './tracker.service';

const mockConfig = { get: jest.fn(() => 'test-api-key') };

describe('TrackerService', () => {
  let service: TrackerService;

  beforeEach(() => {
    service = new TrackerService(mockConfig as any);
  });

  describe('filterAndRank', () => {
    it('removes videos with viewCount below 100,000', () => {
      const input = [
        {
          title: 'A',
          videoId: '1',
          viewCount: 50000,
          channelTitle: 'C',
          publishedAt: new Date().toISOString(),
          keyword: 'k',
        },
        {
          title: 'B',
          videoId: '2',
          viewCount: 200000,
          channelTitle: 'C',
          publishedAt: new Date().toISOString(),
          keyword: 'k',
        },
      ];
      const result = (service as any).filterAndRank(input);
      expect(result).toHaveLength(1);
      expect(result[0].videoId).toBe('2');
    });

    it('deduplicates by videoId keeping the first keyword encountered', () => {
      const input = [
        {
          title: 'A',
          videoId: '1',
          viewCount: 500000,
          channelTitle: 'C',
          publishedAt: new Date().toISOString(),
          keyword: 'kw1',
        },
        {
          title: 'A',
          videoId: '1',
          viewCount: 500000,
          channelTitle: 'C',
          publishedAt: new Date().toISOString(),
          keyword: 'kw2',
        },
      ];
      const result = (service as any).filterAndRank(input);
      expect(result).toHaveLength(1);
      expect(result[0].keyword).toBe('kw1');
    });

    it('sorts by viewCount descending and returns top 3', () => {
      const input = [
        {
          title: 'C',
          videoId: '3',
          viewCount: 100000,
          channelTitle: 'X',
          publishedAt: new Date().toISOString(),
          keyword: 'k',
        },
        {
          title: 'A',
          videoId: '1',
          viewCount: 900000,
          channelTitle: 'X',
          publishedAt: new Date().toISOString(),
          keyword: 'k',
        },
        {
          title: 'D',
          videoId: '4',
          viewCount: 200000,
          channelTitle: 'X',
          publishedAt: new Date().toISOString(),
          keyword: 'k',
        },
        {
          title: 'B',
          videoId: '2',
          viewCount: 500000,
          channelTitle: 'X',
          publishedAt: new Date().toISOString(),
          keyword: 'k',
        },
      ];
      const result = (service as any).filterAndRank(input);
      expect(result).toHaveLength(3);
      expect(result[0].videoId).toBe('1');
      expect(result[1].videoId).toBe('2');
      expect(result[2].videoId).toBe('4');
    });

    it('returns fewer than 3 if not enough results pass the filter', () => {
      const input = [
        {
          title: 'A',
          videoId: '1',
          viewCount: 500000,
          channelTitle: 'X',
          publishedAt: new Date().toISOString(),
          keyword: 'k',
        },
      ];
      expect((service as any).filterAndRank(input)).toHaveLength(1);
    });
  });

  describe('getPublishedAfter', () => {
    it('returns an ISO timestamp approximately 48 hours in the past', () => {
      const result = (service as any).getPublishedAfter();
      const diffHours = (Date.now() - new Date(result).getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(48, 0);
    });
  });
});
