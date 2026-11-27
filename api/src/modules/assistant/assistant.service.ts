import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { vietnamDate } from '../maintenance/maintenance-dates';
import {
  parseReportFilters,
  REPORT_FILTER_SCHEMA,
  reportFilterInstruction,
  type ReportFilters,
} from './report-filters';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';
/** One budget for the first try and the retry. */
const TIMEOUT_MS = 15_000;

type InteractionResponse = {
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
};

const unavailable = () =>
  new ServiceUnavailableException({
    code: 'AI_UNAVAILABLE',
    message: 'Trợ lý tạm thời không phản hồi, hãy thử lại sau.',
  });

@Injectable()
export class AssistantService {
  /** Gemini turns the question into report filters; it never sees farm data. */
  async reportFilters(
    question: string,
    now = new Date(),
  ): Promise<ReportFilters> {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) throw unavailable();
    const body = JSON.stringify({
      model: process.env.AI_MODEL || 'gemini-3.5-flash-lite',
      system_instruction: reportFilterInstruction(vietnamDate(now)),
      input: question,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: REPORT_FILTER_SCHEMA,
      },
    });
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const call = () =>
      fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
        signal,
      });
    let response: Response;
    try {
      response = await call();
      // 503 = model overloaded for a moment; 429 (quota) would not recover.
      if (response.status === 503) response = await call();
    } catch {
      throw unavailable();
    }
    if (!response.ok) throw unavailable();
    let raw: string | undefined;
    try {
      const data = (await response.json()) as InteractionResponse;
      raw = data.steps
        ?.find((step) => step.type === 'model_output')
        ?.content?.find((part) => part.type === 'text')?.text;
    } catch {
      throw unavailable();
    }
    const filters = raw ? parseReportFilters(raw) : null;
    if (!filters) throw unavailable();
    return filters;
  }
}
