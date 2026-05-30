import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ShoppingBag, Soup, StickyNote, DatabaseZap } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { fetchOrder, itemCount, type SupabaseOrder } from "../lib/orders";
import { formatMoney } from "../lib/format";
import { cn } from "../lib/cn";
import EmptyState from "./EmptyState";

type Props = {
  /** The session call_id, once the bot has announced it over RTVI. */
  callId: string | null;
  /** True while a call is connecting or live (gates the realtime subscription). */
  isActive: boolean;
};

export default function OrderInfoCard({ callId, isActive }: Props) {
  const [order, setOrder] = useState<SupabaseOrder | null>(null);
  const [loading, setLoading] = useState(false);

  // Initial fetch (and refetch when the call changes).
  useEffect(() => {
    if (!callId) {
      setOrder(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOrder(callId).then((o) => {
      if (cancelled) return;
      setOrder(o);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  // Realtime: place_order_atomic writes order + items in one transaction, so a
  // single change on `orders` for this call_id is a reliable refetch trigger.
  useEffect(() => {
    const sb = supabase;
    if (!callId || !isActive || !sb) {
      console.info("[order-rt] skip subscribe", { callId, isActive, hasClient: !!sb });
      return;
    }
    let alive = true;
    console.info("[order-rt] subscribing", { callId });
    const channel = sb
      .channel(`order:${callId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          console.info("[order-rt] change event", payload.eventType, payload.new);
          fetchOrder(callId).then((o) => {
            console.info("[order-rt] refetch ->", o ? `${o.order_items.length} items` : "null");
            if (alive) setOrder(o);
          });
        },
      )
      .subscribe((status, err) => {
        console.info("[order-rt] channel status:", status, err ?? "");
      });
    return () => {
      alive = false;
      sb.removeChannel(channel);
    };
  }, [callId, isActive]);

  const hasItems = !!order && order.order_items.length > 0;

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-cream bg-paper-raised shadow-warm">
      <div className="flex items-center justify-between gap-2 border-b border-cream px-5 py-4">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <ShoppingBag className="h-5 w-5 text-gold-600" />
          Live Order
        </h3>
        {hasItems && (
          <span className="rounded-full bg-lacquer-50 px-2 py-0.5 text-xs font-semibold text-lacquer-700">
            {itemCount(order!)} {itemCount(order!) === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      <div className="scroll-warm min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!isSupabaseConfigured ? (
          <EmptyState
            className="h-full justify-center"
            icon={
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream">
                <DatabaseZap className="h-7 w-7 text-gold-600" />
              </div>
            }
            title="Live order disabled"
            description="Add VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env to see orders appear here in real time. The call and transcript work without it."
          />
        ) : loading && !order ? (
          <Skeleton />
        ) : hasItems ? (
          <OrderBody order={order!} />
        ) : (
          <EmptyState
            className="h-full justify-center"
            icon={
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream">
                <Soup className="h-7 w-7 text-gold-600" />
              </div>
            }
            title={callId ? "No items yet" : "Order will appear here"}
            description={
              callId
                ? "As you order, items show up here in real time."
                : "Start a call and tell the receptionist what you'd like."
            }
          />
        )}
      </div>
    </aside>
  );
}

function OrderBody({ order }: { order: SupabaseOrder }) {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{order.fulfillment_type}</Badge>
        <Badge tone="muted">{order.status}</Badge>
        {order.customer_name && (
          <span className="text-sm text-ink-soft">
            for <span className="font-medium text-ink">{order.customer_name}</span>
          </span>
        )}
      </div>

      <div className="space-y-3">
        {order.order_items.map((item) => {
          const title =
            item.variant_name && item.variant_name !== "Regular"
              ? `${item.display_name} · ${item.variant_name}`
              : item.display_name;
          return (
            <div
              key={item.id}
              className="flex items-baseline justify-between gap-3"
            >
              <div className="text-sm text-ink">
                <span className="font-semibold text-lacquer-700">
                  {item.quantity}×
                </span>{" "}
                {title}
              </div>
              <div className="font-mono text-sm text-ink">
                {formatMoney(item.line_total)}
              </div>
            </div>
          );
        })}
      </div>

      {order.notes && (
        <div className="flex gap-2 rounded-xl border border-gold-200 bg-gold-200/20 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
          <StickyNote className="h-4 w-4 shrink-0 text-gold-600" />
          <span>{order.notes}</span>
        </div>
      )}

      <div className="space-y-1.5 border-t border-cream pt-4">
        <Row label="Subtotal" value={formatMoney(order.subtotal)} />
        <Row label="Tax" value={formatMoney(order.tax)} />
        <div className="flex items-center justify-between pt-2">
          <span className="font-display text-base font-bold text-ink">Total</span>
          <span className="font-display text-lg font-bold text-lacquer-700">
            {formatMoney(order.total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        tone === "brand"
          ? "bg-lacquer-50 text-lacquer-700 ring-1 ring-lacquer-100"
          : "bg-cream text-ink-soft",
      )}
    >
      {children}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-1/2 animate-pulse rounded bg-cream" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-cream" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-cream" />
      <div className="mt-6 h-4 w-full animate-pulse rounded bg-cream" />
    </div>
  );
}
