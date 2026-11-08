'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

export function ContactPreviewForm() {
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    setSubmittedName(name || 'bạn');
    form.reset();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-2xs"
    >
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-bold">Gửi yêu cầu tư vấn</h2>
        <p className="text-sm text-muted-foreground">
          Đội ngũ kỹ thuật trại ong sẽ phản hồi qua điện thoại hoặc email trong giờ làm việc.
        </p>
      </div>
      <label className="block space-y-1.5 text-sm font-medium">
        <span>Họ và tên *</span>
        <input
          required
          name="name"
          autoComplete="name"
          placeholder="Tên của bạn"
          className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground"
          onChange={() => setSubmittedName(null)}
        />
      </label>
      <label className="block space-y-1.5 text-sm font-medium">
        <span>Email hoặc Số điện thoại *</span>
        <input
          required
          name="email"
          placeholder="SĐT hoặc địa chỉ email liên hệ"
          className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground"
          onChange={() => setSubmittedName(null)}
        />
      </label>
      <label className="block space-y-1.5 text-sm font-medium">
        <span>Chủ đề cần hỗ trợ</span>
        <select
          name="topic"
          defaultValue="technical"
          className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground"
          onChange={() => setSubmittedName(null)}
        >
          <option value="technical">Tư vấn kỹ thuật chăm sóc đàn ong</option>
          <option value="equipment">Tư vấn chọn thùng ong & máy quay mật</option>
          <option value="warranty">Hỗ trợ đơn hàng & bảo hành sau bán</option>
        </select>
      </label>
      <label className="block space-y-1.5 text-sm font-medium">
        <span>Nội dung câu hỏi *</span>
        <textarea
          required
          name="message"
          rows={4}
          placeholder="Mô tả quy mô đàn ong hoặc thiết bị bạn đang quan tâm…"
          className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground"
          onChange={() => setSubmittedName(null)}
        />
      </label>
      <Button type="submit" className="w-full cursor-pointer">
        Gửi yêu cầu tư vấn
      </Button>
      {submittedName && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Cảm ơn <strong>{submittedName}</strong>! Mộc Ong đã ghi nhận nội dung và sẽ liên hệ tư vấn sớm nhất.
          </span>
        </div>
      )}
    </form>
  );
}
