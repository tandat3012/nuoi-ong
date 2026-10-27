export const storeBankTransfer = {
  bankName: process.env.NEXT_PUBLIC_STORE_BANK_NAME?.trim() ?? "",
  accountName: process.env.NEXT_PUBLIC_STORE_BANK_ACCOUNT_NAME?.trim() ?? "",
  accountNumber:
    process.env.NEXT_PUBLIC_STORE_BANK_ACCOUNT_NUMBER?.trim() ?? "",
  branch: process.env.NEXT_PUBLIC_STORE_BANK_BRANCH?.trim() ?? "",
};

export function hasStoreBankTransferInstructions() {
  return Boolean(
    storeBankTransfer.bankName &&
    storeBankTransfer.accountName &&
    storeBankTransfer.accountNumber,
  );
}
