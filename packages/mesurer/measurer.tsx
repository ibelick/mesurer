import type { MeasurerProps } from "./api";
import { MeasurerRoot } from "./measurer-root";

export default function Measurer(props: MeasurerProps) {
  return <MeasurerRoot {...props} />;
}
