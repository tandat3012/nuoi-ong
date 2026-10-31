/** NAPAS VietQR (EMVCo merchant-presented) payload for a 24/7 account transfer. */
function tlv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC-16/CCITT-FALSE, as required for EMVCo tag 63. */
export function crc16(input: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function vietQrPayload(input: {
  bin: string;
  accountNumber: string;
  amount: string;
  content: string;
}) {
  if (!/^\d{6}$/.test(input.bin)) throw new Error('Bank BIN must be 6 digits');
  if (!/^[0-9A-Za-z]{1,19}$/.test(input.accountNumber))
    throw new Error('Account number must be 1-19 letters or digits');
  if (!/^[1-9]\d{0,12}$/.test(input.amount))
    throw new Error('Amount must be a positive whole VND value');
  // Bank apps drop diacritics and symbols from the transfer note.
  if (!/^[0-9A-Za-z ]{1,25}$/.test(input.content))
    throw new Error('Content must be 1-25 ASCII letters, digits or spaces');
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv(
      '38',
      tlv('00', 'A000000727') +
        tlv('01', tlv('00', input.bin) + tlv('01', input.accountNumber)) +
        tlv('02', 'QRIBFTTA'),
    ) +
    tlv('53', '704') +
    tlv('54', input.amount) +
    tlv('58', 'VN') +
    tlv('62', tlv('08', input.content)) +
    '6304';
  return body + crc16(body);
}
