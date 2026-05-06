import { TrendResult } from '../modules/tracker/trend-result.interface';

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
  duration: string;
}

export interface TranscriptResult {
  transcript: string | null;
  frames: string[];
  metadata: VideoMetadata;
}

export interface VideoAnalysis {
  whyTrending: string;
  visualStrategy: string;
  hookAnalysis: string;
  generatedScript: string;
  suggestedTitle: string;
  suggestedHook: string;
}

export interface EnrichedTrendResult extends TrendResult {
  transcriptData?: TranscriptResult;
  analysis?: VideoAnalysis;
}
