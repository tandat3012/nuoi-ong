export type StoreBankAccount = {
  bin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

/** The store's receiving account, configured on the API so the QR and the webhook check agree. */
export function storeBankAccount(): StoreBankAccount | null {
  const account = {
    bin: process.env.STORE_BANK_BIN?.trim() ?? '',
    bankName: process.env.STORE_BANK_NAME?.trim() ?? '',
    accountNumber: process.env.STORE_BANK_ACCOUNT_NUMBER?.trim() ?? '',
    accountName: process.env.STORE_BANK_ACCOUNT_NAME?.trim() ?? '',
  };
  return Object.values(account).every(Boolean) ? account : null;
}

export function paymentSimulatorEnabled() {
  return process.env.PAYMENT_SIMULATOR_ENABLED === 'true';
}
