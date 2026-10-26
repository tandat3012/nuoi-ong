export function canManagePersonnel(roles: readonly string[]) {
  return roles.some((role) => role === "ADMIN" || role === "FARM_OWNER");
}

export function canEditMember(
  actorRoles: readonly string[],
  targetRoles: readonly string[],
) {
  return (
    canManagePersonnel(actorRoles) &&
    (actorRoles.includes("ADMIN") ||
      !targetRoles.some((role) => role === "ADMIN" || role === "FARM_OWNER"))
  );
}

export function personnelError(error: unknown) {
  const failure = error as {
    status?: number;
    details?: { code?: string };
  } | null;
  const code = failure?.details?.code;
  const messages: Record<string, string> = {
    ACCOUNT_ALREADY_EXISTS:
      "Email đã có tài khoản. Hãy xác nhận thêm tài khoản có sẵn, không tạo lại mật khẩu.",
    MEMBER_ALREADY_EXISTS: "Người này đã là thành viên của trại.",
    MEMBER_INACTIVE:
      "Thành viên đã ngừng hoạt động. Hãy tìm và kích hoạt lại hồ sơ cũ.",
    ACCOUNT_NOT_FOUND: "Không tìm thấy tài khoản với email chính xác này.",
    ACCOUNT_INACTIVE:
      "Tài khoản đã bị khóa. Chủ trại không thể mở khóa tài khoản dùng chung.",
    LAST_FARM_OWNER: "Trại phải còn ít nhất một chủ trại đang hoạt động.",
    EMPLOYEE_CODE_EXISTS: "Mã nhân viên đã tồn tại trong trại.",
    PERSONNEL_CONFLICT:
      "Mã nhân viên hoặc tư cách thành viên đã tồn tại. Hãy tải lại hồ sơ.",
    INVALID_CREDENTIALS:
      "Kiểm tra email và mật khẩu. Mật khẩu phải đáp ứng yêu cầu bảo mật khi đăng nhập.",
    PASSWORD_UNCHANGED: "Hãy chọn mật khẩu mới khác mật khẩu hiện tại.",
    INVALID_WORKPLACE: "Chỉ chọn kho đang hoạt động trong trại này.",
    REQUEST_ID_CONFLICT:
      "Yêu cầu này có nội dung khác lần gửi trước. Liên hệ quản trị viên với mã yêu cầu.",
    IDENTITY_CONFLICT:
      "Cần quản trị viên kiểm tra tài khoản với mã yêu cầu này.",
    PASSWORD_CHANGE_REQUIRED:
      "Bạn cần đổi mật khẩu ban đầu trước khi tiếp tục.",
    ACCOUNT_PROVISION_RETRY:
      "Tài khoản chưa sẵn sàng đăng nhập. Dùng cùng mã yêu cầu để thử lại.",
  };
  // Never render transport messages/objects: they can contain credential request data.
  return {
    code,
    message:
      code && typeof messages[code] === "string"
        ? messages[code]
        : failure?.status === 429
          ? "Quá nhiều lần thử. Vui lòng chờ một phút."
          : failure?.status === 403
            ? "Bạn không còn đủ quyền. Hãy tải lại thông tin trại."
            : failure?.status === 404
              ? "Không tìm thấy hồ sơ trong trại đang chọn."
              : failure?.status === 400
                ? "Kiểm tra các trường nhập và quyền, kho được chọn."
                : "Chưa xác nhận được kết quả. Vui lòng thử lại hoặc tải lại thông tin.",
  };
}
