import { z } from 'zod';

export const BOOK_FORMATS = ['fb2', 'epub', 'mobi'] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

export const catalogSearchQuerySchema = z.object({ q: z.string().trim().min(1).max(200) });
export const catalogBookParamsSchema = z.object({
  id: z.string().regex(/^\d{1,10}$/),
  format: z.enum(BOOK_FORMATS),
});
export const catalogImageQuerySchema = z.object({ src: z.string().min(1).max(2048) });

export const aiSummarizeRequestSchema = z.object({ text: z.string().trim().min(1).max(20_000) });
export interface AiSummarizeResponse {
  summary: string;
}
export interface AiStatusResponse {
  enabled: boolean;
}
