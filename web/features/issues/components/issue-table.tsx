import {
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  type Issue,
} from "../types/issue";

export function IssueTable({
  issues,
  onOpen,
}: {
  issues: Issue[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Danh sách phiếu xuất kho</caption>
        <thead className="border-b bg-muted/50">
          <tr>
            {[
              "Mã phiếu",
              "Ngày xuất",
              "Kho nguồn",
              "Loại phiếu",
              "Trạng thái",
              "Thao tác",
            ].map((label) => (
              <th key={label} scope="col" className="px-4 py-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td className="px-4 py-3 font-mono">{issue.issueCode}</td>
              <td className="whitespace-nowrap px-4 py-3">
                {issue.issueDate.split("-").reverse().join("/")}
              </td>
              <td className="px-4 py-3">
                {issue.warehouseName
                  ? `${issue.warehouseCode ?? ""} — ${issue.warehouseName}`
                  : "Không có thông tin kho"}
              </td>
              <td className="px-4 py-3">
                {ISSUE_TYPE_LABELS[issue.issueType]}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {ISSUE_STATUS_LABELS[issue.status]}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onOpen(issue.id)}
                  aria-label={`Chi tiết phiếu ${issue.issueCode}`}
                  className="rounded-lg border px-3 py-1 hover:bg-muted"
                >
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
