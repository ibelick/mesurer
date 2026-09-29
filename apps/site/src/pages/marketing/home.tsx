import Hero from "./hero";
import ProductCarousel from "./product-carousel";
import MarketingFooter from "./footer";
import AgentWorkflow from "./agent-workflow";
import BrowserSection from "./browser-section";
import FinalCta from "./final-cta";
import SocialProof from "./social-proof";
import PageMetadata from "../../components/page-metadata";

const title = "Build precise software with your coding agent | Mesurer";
const description = "Inspect, annotate, and direct changes on any live interface with Mesurer for Chrome and React.";

export default function MarketingPage() {
  return (
    <main id="overview" className="min-h-screen pb-0 pt-20">
      <PageMetadata title={title} description={description} />
      <div className="mx-auto flex flex-col gap-20 px-5">
        <Hero />
        <ProductCarousel />
        <AgentWorkflow
          id="design-workflow-title"
          title="Design closer to production"
          description="As designers work closer to the source, Mesurer brings all the essential tools they need to preserve quality in that new environment."
          cards={[
            {
              title: "Inspect mode",
              image: "https://assets.querrel.com/mesurer/inspector.webp?v=4",
            },
            {
              title: "Measurements",
              image: "https://assets.querrel.com/mesurer/measurement.webp?v=3",
            },
            {
              title: "Layout guides",
              image: "https://assets.querrel.com/mesurer/guides.webp?v=2",
            },
          ]}
        />
        <AgentWorkflow
          id="agent-workflow-title"
          title="Collaborate better with your team and agents"
          description="Stop describing what you have in mind, show it instead. Mesurer helps you interact faster and in a more effective way with your coding agents."
          cards={[
            {
              title: "Comments",
              image: "https://assets.querrel.com/mesurer/comments.webp?v=3",
            },
            {
              title: "Annotations",
              image: "https://assets.querrel.com/mesurer/annotations.webp?v=5",
            },
            {
              title: "Screenshot-paste",
              image: "https://assets.querrel.com/mesurer/screenshot.webp?v=2",
            },
          ]}
        />
        <BrowserSection />
        <SocialProof />
        <FinalCta />
      </div>
      <MarketingFooter />
    </main>
  );
}
