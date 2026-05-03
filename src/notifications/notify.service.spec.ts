import { NotifyService } from './notify.service';

describe('NotifyService', () => {
  let service: NotifyService;

  beforeEach(() => {
    service = new NotifyService(null as any);
  });

  describe('formatTimeAgo', () => {
    it('formats hours correctly', () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      expect((service as any).formatTimeAgo(sixHoursAgo)).toBe('6 hours ago');
    });

    it('formats minutes correctly', () => {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      expect((service as any).formatTimeAgo(thirtyMinsAgo)).toBe('30 minutes ago');
    });

    it('formats days correctly', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect((service as any).formatTimeAgo(twoDaysAgo)).toBe('2 days ago');
    });
  });

  describe('formatMessage', () => {
    it('formats a trend result into a Telegram message', () => {
      const result = {
        title: 'How I Made $50K',
        videoId: 'abc123',
        viewCount: 1200000,
        channelTitle: 'TechWithTim',
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        keyword: 'AI automation 2026',
      };
      const msg = (service as any).formatMessage(result);
      expect(msg).toContain('How I Made $50K');
      expect(msg).toContain('1,200,000');
      expect(msg).toContain('TechWithTim');
      expect(msg).toContain('AI automation 2026');
      expect(msg).toContain('https://youtube.com/watch?v=abc123');
    });
  });
});
