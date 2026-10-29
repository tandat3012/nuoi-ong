export function formatIssueQuantity(quantity: string): string {
  return quantity.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
