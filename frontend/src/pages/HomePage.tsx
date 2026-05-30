import ConversationPanel from "../components/ConversationPanel";
import OrderInfoCard from "../components/OrderInfoCard";
import { usePipecatCall } from "../hooks/usePipecatCall";

export default function HomePage() {
  const { connect, disconnect, status, callId, turns, error } = usePipecatCall();
  const isActive = status === "live" || status === "connecting";

  return (
    <div className="h-full overflow-y-auto p-4 lg:overflow-hidden lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:h-full lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[70vh] lg:h-full">
          <ConversationPanel
            status={status}
            turns={turns}
            error={error}
            onStart={connect}
            onEnd={disconnect}
          />
        </div>
        <div className="h-[480px] lg:h-full">
          <OrderInfoCard callId={callId} isActive={isActive} />
        </div>
      </div>
    </div>
  );
}
