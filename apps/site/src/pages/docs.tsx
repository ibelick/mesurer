import DocPage from "../components/doc-page";
import ShortcutList from "../components/shortcut-list";

export default function DocsPage() {
  return (
    <DocPage title="Shortcuts" description="Keyboard commands for the Mesurer toolbar.">
      <ShortcutList />
    </DocPage>
  );
}
