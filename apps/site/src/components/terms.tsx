import MarkdownDoc from "./markdown-doc";
import terms from "../../../../packages/mesurer/TERMS.md?raw";

export default function Terms() {
  return <MarkdownDoc source={terms} />;
}
