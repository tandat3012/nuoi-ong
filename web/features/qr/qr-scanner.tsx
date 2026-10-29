"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ScanLine } from "lucide-react";
import { useAuthContext } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { parseScan, scanPath } from "./scan.logic";

function Scanner({ farmId }: { farmId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const navigating = useRef(false);
  function open(value: string) {
    const parsed = parseScan(value, window.location.origin);
    if (!parsed) {
      setError(
        "QR không phải nhãn tài sản, mặt hàng hay tồn kho của hệ thống này. Bạn có thể nhập mã tài sản trực tiếp.",
      );
      return false;
    }
    if (navigating.current) return true;
    navigating.current = true;
    setRunning(false);
    router.push(scanPath(parsed));
    return true;
  }
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("UNSUPPORTED");
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        controls = await new BrowserQRCodeReader().decodeFromStream(
          stream,
          video.current!,
          (result, _error, scanner) => {
            if (!cancelled && result && openRef.current(result.getText()))
              scanner.stop();
          },
        );
        if (cancelled) {
          controls.stop();
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (failure) {
        stream?.getTracks().forEach((track) => track.stop());
        if (!cancelled) {
          setRunning(false);
          setError(
            failure instanceof DOMException &&
              failure.name === "NotAllowedError"
              ? "Chưa được phép dùng camera. Cho phép camera trong trình duyệt hoặc nhập mã bên dưới."
              : "Không mở được camera. Kiểm tra thiết bị và kết nối HTTPS, hoặc nhập mã bên dưới.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [running]);
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Tra cứu QR"
        description="Quét nhãn tài sản, mặt hàng hoặc tồn kho, hay nhập mã tài sản, để xem trong trang trại đang chọn."
      />
      <section className="mx-auto max-w-xl space-y-5 rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <ScanLine className="size-6 text-primary" aria-hidden="true" />
          <h2 className="font-semibold">Quét nhãn QR</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Camera chỉ bật khi bạn chọn mở và tự tắt khi dừng hoặc rời trang.
        </p>
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Hình ảnh camera quét QR"
          className={
            running
              ? "aspect-square w-full rounded-xl bg-black object-cover"
              : "hidden"
          }
        />
        <Button
          className="w-full"
          variant={running ? "outline" : "default"}
          onClick={() => {
            setError("");
            setRunning((value) => !value);
          }}
        >
          <Camera className="size-4" aria-hidden="true" />
          {running ? "Dừng camera" : "Mở camera quét QR"}
        </Button>
        {error && <ErrorAlert message={error} />}
        <form
          className="space-y-3 border-t pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            open(code);
          }}
        >
          <label
            htmlFor="asset-scan-code"
            className="block text-sm font-medium"
          >
            Hoặc nhập mã tài sản / URL nhãn
          </label>
          <Input
            id="asset-scan-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            maxLength={2048}
            placeholder="Ví dụ: AST-SMOKER-001"
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={!code.trim()}
          >
            Tra cứu
          </Button>
        </form>
        <span className="sr-only">Trang trại {farmId}</span>
      </section>
    </div>
  );
}

export function QrScanner() {
  const { selectedFarmId, isLoading, error } = useAuthContext();
  if (isLoading) return <p role="status">Đang tải trang trại…</p>;
  if (error)
    return (
      <ErrorAlert message="Không tải được quyền truy cập trang trại. Vui lòng tải lại trang." />
    );
  if (!selectedFarmId)
    return <p role="status">Chọn trang trại trước khi quét tài sản.</p>;
  return <Scanner key={selectedFarmId} farmId={selectedFarmId} />;
}
