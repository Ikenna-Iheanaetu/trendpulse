import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TranscriptResult, VideoAnalysis } from '../../interfaces/enriched-trend-result.interface';
import { TrendResult } from '../tracker/trend-result.interface';

const SYSTEM_PROMPT = `You are an expert YouTube Shorts content strategist.

You will be given a trending YouTube video's frames, transcript (if available), metadata, and stats.

Your job:
1. Analyze WHY this video is trending — what structural, emotional, or informational hooks drive its views
2. Break down the visual strategy — text overlays, pacing, transitions, thumbnail composition
3. Analyze the first frame (the hook) — exactly what makes the first 3 seconds compelling
4. Generate a ready-to-use 60-second YouTube Shorts script on the same topic with a fresh angle
5. The script must follow this timestamp format:
   [0-3s] Hook line here
   [3-15s] Content here
   [15-30s] Content here
   [30-45s] Content here
   [45-60s] CTA here
6. Suggest an optimized title for your video
7. Suggest a single-sentence hook for a text overlay

Write in a sharp, analytical, confident tone — not hype, not corporate, just smart and direct.
If transcript is not available, rely on visual analysis of the frames alone.

Respond ONLY with valid JSON in this exact shape:
{
  "whyTrending": "3-4 sentence analysis",
  "visualStrategy": "description of visual elements that work",
  "hookAnalysis": "why the first 3 seconds work",
  "generatedScript": "full timestamped script",
  "suggestedTitle": "optimized title",
  "suggestedHook": "single sentence hook for text overlay"
}`;

@Injectable()
export class ScriptService {
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  async analyzeVideo(result: TrendResult, transcriptData: TranscriptResult): Promise<VideoAnalysis> {
    const { transcript, frames, metadata } = transcriptData;

    const textContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: `Video: "${result.title}" by ${result.channelTitle}\nViews: ${result.viewCount.toLocaleString()}\nKeyword niche: ${result.keyword}\nDescription: ${metadata.description.slice(0, 500)}\nTags: ${metadata.tags.slice(0, 10).join(', ')}\nLikes: ${metadata.likeCount.toLocaleString()}\nDuration: ${metadata.duration}`,
      },
      {
        type: 'text',
        text: transcript
          ? `Transcript:\n${transcript.slice(0, 6000)}`
          : 'Transcript: Not available. Use visual analysis only.',
      },
    ];

    const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = frames.map((base64) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:image/jpeg;base64,${base64}`,
        detail: 'low' as const,
      },
    }));

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [...textContent, ...imageContent],
        },
      ],
      max_tokens: 2000,
    });

    const raw = response.choices[0].message.content ?? '{}';
    return JSON.parse(raw) as VideoAnalysis;
  }
}
