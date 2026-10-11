import { useI18n } from "src/i18n";
import { Leaf } from "lucide-react";
interface IProps {
  error?: string;
}
const LoadingState: React.FC<IProps> = ({ error }) => {
  const { t: tr, error: translateError } = useI18n();
  return error ? (
    <main className="loading">
      <Leaf />
      <h1>{tr("aLittleSetupNeeded")}</h1>
      <p>{translateError(error)}</p>
      <a href="./">{tr("tryAgain")}</a>
    </main>
  ) : (
    <main className="loading">
      <Leaf className="pulse" />
      <h1>{tr("settingYourTable")}</h1>
      <p>{tr("goodThingsAreComingToYourKitchen")}</p>
    </main>
  );
};
export default LoadingState;
