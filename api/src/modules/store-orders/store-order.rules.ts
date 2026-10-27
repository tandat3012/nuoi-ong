import { BadRequestException } from '@nestjs/common';
import { MAX_MONEY } from '../../common/money';

export function orderCode(number: number) {
  return `DH${String(number).padStart(6, '0')}`;
}

export function checkedMoney(value: bigint) {
  if (value < 0n || value > MAX_MONEY)
    throw new BadRequestException('Order amount exceeds the supported range');
  return value.toString();
}

export function quantityMillis(value: string) {
  if (!/^\d{1,15}(\.\d{1,3})?$/.test(value))
    throw new BadRequestException('Invalid stock quantity');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
}

export function stockQuantity(value: bigint) {
  if (value <= 0n || value >= 10n ** 18n)
    throw new BadRequestException('Stock quantity exceeds the supported range');
  return `${value / 1000n}.${String(value % 1000n).padStart(3, '0')}`;
}
