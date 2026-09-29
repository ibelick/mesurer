import MarkdownDoc from "./markdown-doc";
import privacy from "../../../../packages/mesurer/PRIVACY.md?raw";

export default function Privacy() {
  return <MarkdownDoc source={privacy} />;
}
