import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { isVndAmount } from '../../common/money';
import {
  CreateStoreVariantDto,
  UpdateStoreVariantDto,
} from '../store-admin/dto/store-variant.dto';
import { CreateStoreOrderDto } from './dto/store-order.dto';
import { orderDateRange } from './store-order.query';
import {
  checkedMoney,
  orderCode,
  quantityMillis,
  stockQuantity,
} from './store-order.rules';

describe('Store order boundaries', () => {
  it('keeps fractional stock steps exact without changing the sale price unit', () => {
    expect(stockQuantity(quantityMillis('0.125') * 3n)).toBe('0.375');
    expect(checkedMoney(185000n * 3n)).toBe('555000');
    expect(orderCode(123)).toBe('DH000123');
    expect(orderCode(1234567)).toBe('DH1234567');
  });

  it('rejects amounts and stock quantities outside supported precision', () => {
    expect(isVndAmount('9007199254740991')).toBe(true);
    for (const value of ['9007199254740992', '-1', '1.5', 'NaN', '01', '1e3'])
      expect(isVndAmount(value)).toBe(false);
    expect(() => checkedMoney(9007199254740992n)).toThrow();
    expect(() => stockQuantity(10n ** 18n)).toThrow();
    expect(() => stockQuantity(0n)).toThrow();
  });

  it('enforces the price maximum for both admin variant DTOs', async () => {
    for (const Type of [CreateStoreVariantDto, UpdateStoreVariantDto]) {
      const dto = plainToInstance(Type, {
        itemId: '11111111-1111-4111-8111-111111111111',
        name: 'Mật ong',
        price: '9007199254740992',
      });
      expect(
        (await validate(dto)).some((error) => error.property === 'price'),
      ).toBe(true);
    }
  });

  it('rejects duplicate variants, fractional quantities and client-supplied totals', async () => {
    const line = {
      variantId: '11111111-1111-4111-8111-111111111111',
      quantity: 1,
    };
    const base = {
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
      recipientName: 'Khách',
      phone: '0901234567',
      address: 'Địa chỉ nhận hàng',
      paymentMethod: 'COD',
    };
    for (const payload of [
      { ...base, items: [line, line] },
      { ...base, items: [{ ...line, quantity: 1.5 }] },
      { ...base, items: [line], total: '1' },
    ]) {
      expect(
        (
          await validate(plainToInstance(CreateStoreOrderDto, payload), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      ).toBeGreaterThan(0);
    }
  });

  it('validates actual calendar dates and inclusive date ranges', () => {
    expect(orderDateRange('2026-02-28', '2026-03-01')).toEqual({
      from: '2026-02-28',
      to: '2026-03-01',
    });
    for (const date of [
      '2026-02-30',
      '2026-13-01',
      '2026-1-1',
      '0000-01-01',
      '',
    ])
      expect(() => orderDateRange(date)).toThrow();
    expect(() => orderDateRange('2026-03-01', '2026-02-28')).toThrow();
  });
});
