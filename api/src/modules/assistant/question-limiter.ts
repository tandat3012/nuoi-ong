import { HttpException, HttpStatus } from '@nestjs/common';

/** Questions one member may ask per farm in a sliding minute. */
export const QUESTIONS_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

/**
 * Keeps one member from using up the shared Gemini quota.
 * shortcut: in memory and per API process, so a restart resets it and several instances
 * each allow the limit; move to Postgres or Redis if the API ever runs more than one instance.
 */
export class QuestionLimiter {
  private readonly asked = new Map<string, number[]>();

  take(key: string, now = Date.now()) {
    if (this.asked.size > 1000)
      for (const [other, times] of this.asked)
        if (times[times.length - 1] <= now - WINDOW_MS)
          this.asked.delete(other);
    const times = (this.asked.get(key) ?? []).filter(
      (time) => time > now - WINDOW_MS,
    );
    if (times.length >= QUESTIONS_PER_MINUTE)
      throw new HttpException(
        {
          code: 'AI_RATE_LIMITED',
          message: `Mỗi người hỏi tối đa ${QUESTIONS_PER_MINUTE} câu mỗi phút, hãy thử lại sau.`,
          retryAfterSeconds: Math.ceil((times[0] + WINDOW_MS - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    times.push(now);
    this.asked.set(key, times);
  }
}
