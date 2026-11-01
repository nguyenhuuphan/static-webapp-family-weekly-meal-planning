import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, X, ZoomIn, ZoomOut } from "lucide-react";
import { useText } from "src/i18n";
import { useFamilyAccess } from "src/hooks/useFamilyAccess";
import { Button } from "src/modules/shared-main/components";
import { receiptPhotoRequest } from "src/services/receiptPhotos";
export default function PhotoViewer({
  id,
  close,
}: {
  id: string;
  close: () => void;
}) {
  const text = useText(),
    { accessCode } = useFamilyAccess();
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState(""),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0),
    [zoom, setZoom] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (dialog.current?.showModal) dialog.current.showModal();
    else dialog.current?.setAttribute("open", "");
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    let active = true;
    setData("");
    setError(false);
    receiptPhotoRequest(accessCode, id)
      .then((result) => {
        if (active) setData(result.data!);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [id, accessCode, attempt]);
  return (
    <dialog
      ref={dialog}
      className="receipt-photo-dialog"
      aria-labelledby="receipt-photo-title"
      onCancel={close}
    >
      <div className="receipt-photo-header">
        <h2 id="receipt-photo-title">{text("Ảnh hóa đơn", "Receipt photo")}</h2>
        <Button
          aria-label={text("Đóng ảnh hóa đơn", "Close receipt photo")}
          onClick={close}
        >
          <X aria-hidden="true" size={18} />
        </Button>
      </div>
      {!data && !error && (
        <p role="status">
          <LoaderCircle aria-hidden="true" className="ai-spinner" size={20} />{" "}
          {text("Đang tải ảnh…", "Loading photo…")}
        </p>
      )}
      {error && (
        <div role="alert">
          <p>
            {text(
              "Chưa tải được ảnh. Kiểm tra kết nối Internet và mã gia đình trong phần Đồng bộ.",
              "Could not load the photo. Check your Internet connection and family code in Family sync.",
            )}
          </p>
          <Button onClick={() => setAttempt(attempt + 1)}>
            {text("Thử tải lại", "Retry loading photo")}
          </Button>
        </div>
      )}
      {data && (
        <>
          <div className="actions">
            <Button aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
              {zoom ? (
                <ZoomOut aria-hidden="true" size={16} />
              ) : (
                <ZoomIn aria-hidden="true" size={16} />
              )}{" "}
              {zoom
                ? text("Vừa màn hình", "Fit to screen")
                : text("Phóng to để đọc", "Zoom to read")}
            </Button>
            <a
              className="receipt-download"
              href={data}
              download={`receipt-${id}.jpg`}
            >
              <Download aria-hidden="true" size={16} />
              {text("Tải ảnh", "Download photo")}
            </a>
          </div>
          <div className={`receipt-photo-canvas ${zoom ? "is-zoomed" : ""}`}>
            <img
              src={data}
              alt={text("Nội dung hóa đơn đã lưu", "Saved receipt contents")}
            />
          </div>
        </>
      )}
    </dialog>
  );
}
