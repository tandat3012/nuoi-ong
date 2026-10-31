import { crc16, vietQrPayload } from './vietqr';

describe('VietQR payload', () => {
  const input = {
    bin: '970436',
    accountNumber: '0011001234567',
    amount: '150000',
    content: 'DH000123',
  };

  it('computes CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
    expect(crc16('')).toBe('FFFF');
  });

  it('encodes the NAPAS fields with correct lengths and a self-consistent CRC', () => {
    const payload = vietQrPayload(input);
    expect(payload.startsWith('000201010212')).toBe(true);
    expect(payload).toContain(
      '38570010A00000072701270006970436011300110012345670208QRIBFTTA',
    );
    expect(payload).toContain('5303704');
    expect(payload).toContain('5406150000');
    expect(payload).toContain('5802VN');
    expect(payload).toContain('62120808DH000123');
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it('rejects values a bank app cannot read', () => {
    expect(() => vietQrPayload({ ...input, amount: '0' })).toThrow('Amount');
    expect(() => vietQrPayload({ ...input, amount: '-5' })).toThrow('Amount');
    expect(() => vietQrPayload({ ...input, amount: '1.5' })).toThrow('Amount');
    expect(() => vietQrPayload({ ...input, content: 'Đơn 1' })).toThrow(
      'Content',
    );
    expect(() => vietQrPayload({ ...input, bin: 'VCB' })).toThrow('BIN');
  });
});
