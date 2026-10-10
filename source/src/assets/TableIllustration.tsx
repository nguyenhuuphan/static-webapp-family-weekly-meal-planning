import { Leaf } from "lucide-react";
const TableIllustration: React.FC = () => (
  <div className="table-art" aria-hidden="true">
    <div className="napkin"></div>
    <div className="plate">
      <div className="plate-inner">
        <Leaf size={43} strokeWidth={1} />
        <span>made with care</span>
      </div>
    </div>
    <div className="fork">
      <i></i>
      <i></i>
      <i></i>
    </div>
    <div className="art-label">THE WEEKDAY TABLE</div>
  </div>
);
export default TableIllustration;
