import Changelog from "../components/changelog";
import DocPage from "../components/doc-page";

export default function ChangelogPage() {
  return (
    <DocPage title="Changelog" description="Release notes for the package.">
      <Changelog />
    </DocPage>
  );
}
