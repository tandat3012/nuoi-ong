'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';

export function ContactPreviewForm() {
  const [previewed, setPreviewed] = useState(false);

  function showPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreviewed(true);
  }

  return (
    <form onSubmit={showPreview} className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-serif text-2xl font-bold">Gửi lời nhắn</h2>
      <p className="text-sm text-muted-foreground">Biểu mẫu đang ở chế độ xem trước, chưa gửi lời nhắn đến cửa hàng.</p>
      <label className="block space-y-2 text-sm font-medium">Họ và tên
        <input required name="name" autoComplete="name" placeholder="Tên của bạn" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground" onChange={() => setPreviewed(false)} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Email
        <input required name="email" type="email" autoComplete="email" placeholder="Địa chỉ email" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground" onChange={() => setPreviewed(false)} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Nội dung
        <textarea required name="message" rows={5} placeholder="Mộc Ong có thể giúp gì cho bạn?" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground" onChange={() => setPreviewed(false)} />
      </label>
      <Button type="submit">Xem trước lời nhắn</Button>
      {previewed && <p role="status" className="text-sm text-muted-foreground">Lời nhắn đã được xem trước. Chưa gửi đến cửa hàng.</p>}
    </form>
  );
}
