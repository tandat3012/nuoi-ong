import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/clerk/public.decorator';
import { SepayWebhookDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

/** Constant-time check of `Authorization: Apikey <key>`; no key configured means the webhook is off. */
export function isSepayAuthorized(header: string | undefined) {
  const key = process.env.SEPAY_WEBHOOK_API_KEY?.trim();
  if (!key || !header) return false;
  const expected = Buffer.from(`Apikey ${key}`);
  const received = Buffer.from(header.trim());
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

@Controller('payments/webhooks')
@ApiTags('Thanh toán')
export class PaymentWebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  /** SePay retries on non-2xx, so every recorded transfer — matched or not — returns success. */
  @Post('sepay')
  @Public()
  @HttpCode(200)
  async sepay(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: SepayWebhookDto,
  ) {
    if (!isSepayAuthorized(authorization))
      throw new UnauthorizedException('Invalid webhook API key');
    await this.payments.sepay(input);
    return { success: true };
  }
}
