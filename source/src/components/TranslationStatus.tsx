import { useSyncExternalStore } from "react";
import { useText } from "src/i18n";
import {
  automaticTranslationState,
  retryAutomaticTranslations,
  subscribeTranslations,
  translationVersion,
} from "src/i18n/automatic";
import { Button } from "src/modules/shared-main/components";
export default function TranslationStatus() {
  const text = useText();
  useSyncExternalStore(subscribeTranslations, translationVersion, () => 0);
  const { pending, failed, needsLogin } = automaticTranslationState();
  if (!pending && !failed) return null;
  return (
    <section className="notice" role="status">
      {pending > 0
        ? text("Đang dịch nội dung mới…", "Translating new content…")
        : needsLogin
          ? text(
              "Dịch tự động đang bị Netlify yêu cầu đăng nhập. Nội dung gốc được giữ nguyên.",
              "Automatic translation needs Netlify sign-in. Original text is retained.",
            )
          : text(
              "Chưa dịch được một số nội dung do lỗi kết nối hoặc giới hạn dịch vụ miễn phí. Nội dung gốc được giữ nguyên.",
              "Some content could not be translated because of a connection error or free-service limit. Original text is retained.",
            )}
      {failed > 0 && !pending && (
        <Button onClick={retryAutomaticTranslations}>
          {text("Thử dịch lại", "Retry translation")}
        </Button>
      )}
    </section>
  );
}
