import { useAgentStore } from "../store/useAgentStore";
import BrowserCanvas from "./BrowserCanvas";
import AgentTimelineFeed from "./AgentTimelineFeed";
import HitlInterventionCard from "./HitlInterventionCard";

export default function SplitWorkspace() {
  const pendingHitl = useAgentStore((s) => s.pendingHitl);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <section className="flex min-h-[320px] flex-1 flex-col border-b border-slate-800 p-3 lg:border-b-0 lg:border-r">
        <BrowserCanvas />
      </section>
      <aside className="flex min-h-0 w-full flex-col lg:w-[420px] xl:w-[480px]">
        {pendingHitl && (
          <div className="border-b border-slate-800 p-3">
            <HitlInterventionCard key={pendingHitl.id} request={pendingHitl} />
          </div>
        )}
        <div className="min-h-0 flex-1">
          <AgentTimelineFeed />
        </div>
      </aside>
    </div>
  );
}
