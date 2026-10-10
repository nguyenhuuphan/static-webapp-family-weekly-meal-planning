import { Leaf } from "lucide-react";
interface IProps {
  error?: string;
}
const LoadingState: React.FC<IProps> = ({ error }) =>
  error ? (
    <main className="loading">
      <Leaf />
      <h1>A little setup needed.</h1>
      <p>{error}</p>
      <a href="./">Try again</a>
    </main>
  ) : (
    <main className="loading">
      <Leaf className="pulse" />
      <h1>Setting your table…</h1>
      <p>Good things are coming to your kitchen.</p>
    </main>
  );
export default LoadingState;
