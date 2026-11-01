import { useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useText } from "src/i18n";
import { useMealPlanner } from "src/hooks/useMealPlanner";
import { useFamilyAccess } from "src/hooks/useFamilyAccess";
import { Button } from "src/modules/shared-main/components";
import {
  CURRENCIES,
  localPurchaseDate,
  moneyInput,
  parseMoney,
  saveInvoice,
  validPurchaseDate,
  type Money,
  type ShoppingInvoice,
} from "src/helpers/purchaseHistory";
import {
  prepareReceiptPhoto,
  receiptPhotoRequest,
  type ReceiptPhotoDraft,
} from "src/services/receiptPhotos";
export default function InvoiceEditor({
  invoice,
  done,
}: {
  invoice?: ShoppingInvoice;
  done: (saved?: boolean) => void;
}) {
  const text = useText(),
    { command } = useMealPlanner(),
    { accessCode } = useFamilyAccess();
  const [id] = useState(() => invoice?.id || crypto.randomUUID());
  const [shop, setShop] = useState(invoice?.shop || ""),
    [date, setDate] = useState(invoice?.purchasedOn || localPurchaseDate()),
    [amount, setAmount] = useState(moneyInput(invoice?.total)),
    [currency, setCurrency] = useState<Money["currency"]>(
      invoice?.total?.currency || "VND",
    ),
    [note, setNote] = useState(invoice?.note || ""),
    [photos, setPhotos] = useState<ReceiptPhotoDraft[]>([]),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [uploaded, setUploaded] = useState(0);
  const camera = useRef<HTMLInputElement>(null),
    library = useRef<HTMLInputElement>(null),
    lock = useRef(false),
    savedDraftPhotos = useRef(new Set<string>());
  const errors: Record<string, string> = {
    invalid_price: text(
      "Giá không hợp lệ. VND dùng số nguyên; USD/EUR tối đa 2 số thập phân.",
      "Enter a valid price: whole VND, or up to 2 decimal places for USD/EUR.",
    ),
    photo_unauthorized: text(
      "Kết nối Đồng bộ gia đình trước khi lưu ảnh.",
      "Connect Family sync before saving photos.",
    ),
    photo_storage_full: text(
      "Kho ảnh đã đầy hoặc hóa đơn đã đủ 6 ảnh. Hóa đơn chưa được thay đổi.",
      "Photo storage is full, or this invoice already has 6 photos. The invoice was not changed.",
    ),
    photo_too_large: text(
      "Ảnh quá lớn. Thử chụp gần hơn hoặc chia hóa đơn thành nhiều ảnh.",
      "The photo is too large. Take a closer photo or split the receipt across photos.",
    ),
    unsupported_photo: text(
      "Điện thoại chưa đọc được ảnh này. Chọn ảnh JPEG/PNG hoặc chụp lại.",
      "This image could not be opened. Choose JPEG/PNG or take another photo.",
    ),
    invalid_photo: text(
      "Chọn ảnh hợp lệ, tối đa 20 MB trước khi nén.",
      "Choose a valid image up to 20 MB before compression.",
    ),
  };
  async function addFiles(files: FileList | null) {
    if (!files || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (files.length + photos.length + (invoice?.photos.length || 0) > 6)
        throw Error("photo_storage_full");
      const next: ReceiptPhotoDraft[] = [];
      for (const file of Array.from(files))
        next.push(await prepareReceiptPhoto(file));
      setPhotos((old) => [...old, ...next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "network");
    } finally {
      lock.current = false;
      setBusy(false);
      if (camera.current) camera.current.value = "";
      if (library.current) library.current.value = "";
    }
  }
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setSaving(true);
    setError("");
    setUploaded(0);
    try {
      const total = parseMoney(amount, currency);
      if (!validPurchaseDate(date)) throw Error("invalid_date");
      if (photos.length && accessCode.length < 16)
        throw Error("photo_unauthorized");
      for (let i = 0; i < photos.length; i++) {
        await receiptPhotoRequest(accessCode, photos[i].id, {
          invoiceId: id,
          data: photos[i].data,
        });
        savedDraftPhotos.current.add(photos[i].id);
        setUploaded(i + 1);
      }
      const now = new Date().toISOString();
      const next: ShoppingInvoice = {
        id,
        shop: shop.trim(),
        purchasedOn: date,
        total,
        note: note.trim(),
        photos: [...(invoice?.photos || []), ...photos.map((p) => p.id)],
        createdAt: invoice?.createdAt || now,
        updatedAt: now,
      };
      if (await command("invoice.save", { invoice: next })) done(true);
      else setError("save_failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "network");
    } finally {
      lock.current = false;
      setBusy(false);
      setSaving(false);
    }
  }
  async function removeDraftPhoto(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (savedDraftPhotos.current.has(id))
        await receiptPhotoRequest(accessCode, id, undefined, "DELETE");
      savedDraftPhotos.current.delete(id);
      setPhotos((old) => old.filter((p) => p.id !== id));
    } catch {
      setError("network");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function cancel() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    // Only unlinked draft uploads are eligible for deletion; saved receipts are protected by the API.
    await Promise.allSettled(
      [...savedDraftPhotos.current].map((id) =>
        receiptPhotoRequest(accessCode, id, undefined, "DELETE"),
      ),
    );
    done();
  }
  let valid = true;
  try {
    parseMoney(amount, currency);
    valid =
      validPurchaseDate(date) &&
      !!(
        shop.trim() ||
        note.trim() ||
        amount.trim() ||
        photos.length ||
        invoice?.photos.length
      );
  } catch {
    valid = false;
  }
  return (
    <section
      className="panel invoice-editor"
      aria-labelledby="invoice-editor-title"
    >
      <h3 id="invoice-editor-title">
        {invoice
          ? text("Sửa hóa đơn", "Edit receipt")
          : text("Thêm hóa đơn", "Add receipt")}
      </h3>
      <fieldset disabled={busy}>
        <div className="receipt-form-grid">
          <label>
            {text("Cửa hàng / nơi mua", "Shop / place of purchase")}
            <input
              maxLength={160}
              value={shop}
              onChange={(e) => setShop(e.target.value)}
            />
          </label>
          <label>
            {text("Ngày mua", "Purchase date")}
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            {text(
              "Tổng tiền hóa đơn (không bắt buộc)",
              "Receipt total (optional)",
            )}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step={currency === "VND" ? "1" : "0.01"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            {text("Tiền tệ", "Currency")}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Money["currency"])}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {text(
            "Ghi chú / món đã mua để dễ tìm lại",
            "Notes / purchased items to help you search later",
          )}
          <textarea
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="actions receipt-capture-actions">
          <Button onClick={() => camera.current?.click()}>
            <Camera aria-hidden="true" size={18} />
            {text("Chụp hóa đơn", "Take receipt photo")}
          </Button>
          <Button onClick={() => library.current?.click()}>
            <ImagePlus aria-hidden="true" size={18} />
            {text("Chọn ảnh có sẵn", "Choose existing photos")}
          </Button>
        </div>
        <input
          ref={camera}
          className="receipt-file-input"
          tabIndex={-1}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label={text(
            "Chụp ảnh hóa đơn bằng camera",
            "Capture receipt with camera",
          )}
          onChange={(e) => void addFiles(e.target.files)}
        />
        <input
          ref={library}
          className="receipt-file-input"
          tabIndex={-1}
          type="file"
          accept="image/*"
          multiple
          aria-label={text(
            "Chọn ảnh hóa đơn từ thư viện",
            "Select receipt photos from library",
          )}
          onChange={(e) => void addFiles(e.target.files)}
        />
        <p className="caption">
          {text(
            "Tối đa 6 ảnh mỗi hóa đơn. Ảnh được nén trên thiết bị; kiểm tra chữ rõ trước khi lưu.",
            "Up to 6 photos per receipt. Photos are compressed on this device; check that the text is readable before saving.",
          )}
          {invoice?.photos.length
            ? ` · ${invoice.photos.length} ${text("ảnh đã lưu", "saved photos")}`
            : ""}
        </p>
        <div className="receipt-photo-drafts">
          {photos.map((p, i) => (
            <figure key={p.id}>
              <img
                src={p.data}
                alt={`${text("Ảnh hóa đơn mới", "New receipt photo")} ${i + 1}`}
              />
              <Button
                aria-label={`${text("Bỏ ảnh mới", "Remove new photo")} ${i + 1}`}
                onClick={() => void removeDraftPhoto(p.id)}
              >
                <X aria-hidden="true" size={16} />
              </Button>
            </figure>
          ))}
        </div>
      </fieldset>
      {busy && (
        <p role="status">
          <LoaderCircle aria-hidden="true" className="ai-spinner" size={18} />
          {saving
            ? text(
                `Đang lưu hóa đơn… ${uploaded}/${photos.length} ảnh`,
                `Saving receipt… ${uploaded}/${photos.length} photos`,
              )
            : text("Đang chuẩn bị ảnh…", "Preparing photos…")}
        </p>
      )}
      {error && (
        <p role="alert" className="notice warning">
          {errors[error] ||
            text(
              "Chưa lưu được hóa đơn. Dữ liệu trong biểu mẫu vẫn được giữ, hãy kiểm tra kết nối rồi thử lưu lại.",
              "Could not save the receipt. Your form is retained; check the connection and try saving again.",
            )}
        </p>
      )}
      <div className="actions">
        <Button disabled={busy} onClick={() => void cancel()}>
          {text("Hủy", "Cancel")}
        </Button>
        <Button primary disabled={busy || !valid} onClick={() => void save()}>
          {text("Lưu hóa đơn", "Save receipt")}
        </Button>
      </div>
    </section>
  );
}
