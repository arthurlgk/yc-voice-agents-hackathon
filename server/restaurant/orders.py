"""The single Supabase write for an order.

``place_order`` is the agent's only ordering tool. It resolves each spoken item
to a real menu row, prices the order (7% tax), and upserts it via the
``place_order_atomic`` RPC keyed on ``(restaurant_id, call_id)``. Rice choices,
spice preferences, and special requests ride along as free text in
``orders.notes`` (the simplified agent does not write structured modifier rows).

Call-record lifecycle (``insert_call_row`` / ``complete_call_row``) lives in
``restaurant.calls`` — different table, different pipeline events.
"""

import logging
from decimal import ROUND_HALF_UP, Decimal

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams
from supabase._async.client import AsyncClient

from restaurant.catalog import (
    OrderResolutionError,
    clean_name,
    is_combo,
    money,
    resolve_combo_modifiers,
    resolve_item,
)

logger = logging.getLogger("restaurant.orders")

TAX_RATE = Decimal("0.07")
PLACE_ORDER_RPC = "place_order_atomic"

# Explicit JSON Schema (rather than a typed direct function) so the open
# Nemotron model gets a hand-written, minimal tool contract for the nested
# items array, with an enum constraining size.
place_order_schema = FunctionSchema(
    name="place_order",
    description=(
        "Place the customer's food order. Call this once, only after you have "
        "read the full order back and the customer confirmed. If the customer "
        "later changes the order in the same call, call this again with the "
        "COMPLETE updated item list (not the change); it replaces the order. "
        "For combo items (Lunch/Dinner Specials) pass the caller's rice and "
        "appetizer on each item's `side` and `appetizer` fields. Put spice "
        "preferences and any other special requests in `notes`."
    ),
    properties={
        "items": {
            "type": "array",
            "description": "Every dish the customer is ordering.",
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": (
                            "Dish name exactly as written in the menu heading, "
                            "for example 'Beef w. Broccoli'. Do not include the "
                            "menu code and do not expand abbreviations here."
                        ),
                    },
                    "quantity": {
                        "type": "integer",
                        "minimum": 1,
                        "description": "How many of this dish.",
                    },
                    "size": {
                        "type": "string",
                        "enum": ["Small", "Large"],
                        "description": (
                            "Only for items that list both sm_price and "
                            "lg_price. Omit for single-price items and combos."
                        ),
                    },
                    "side": {
                        "type": "string",
                        "description": (
                            "Combo items only: the side/rice choice, e.g. "
                            "'Pork Fried Rice', 'Steamed Rice', or 'Lo Mein'."
                        ),
                    },
                    "appetizer": {
                        "type": "string",
                        "description": (
                            "Combo items only: the appetizer choice, e.g. "
                            "'Egg Roll' or 'Crab Rangoons'."
                        ),
                    },
                },
                "required": ["name", "quantity"],
            },
        },
        "fulfillment_type": {
            "type": "string",
            "enum": ["pickup", "delivery"],
            "description": "How the customer wants the order.",
        },
        "customer_name": {
            "type": "string",
            "description": "The customer's name for the order.",
        },
        "customer_phone": {
            "type": "string",
            "description": "A callback phone number, if given.",
        },
        "delivery_address": {
            "type": "string",
            "description": "Required only for delivery orders.",
        },
        "notes": {
            "type": "string",
            "description": (
                "Rice choices, spice preferences, and special requests, as "
                "plain text."
            ),
        },
    },
    required=["items", "fulfillment_type", "customer_name"],
)


def build_place_order_handler(
    client: AsyncClient,
    restaurant_id: str,
    restaurant_name: str,
    call_id: str,
):
    """Return a ``place_order`` handler closed over this call's context."""

    async def handle_place_order(params: FunctionCallParams) -> None:
        args = params.arguments or {}
        items = args.get("items") or []
        fulfillment = (args.get("fulfillment_type") or "pickup").lower()
        customer_name = args.get("customer_name")
        customer_phone = args.get("customer_phone")
        delivery_address = args.get("delivery_address")
        notes = args.get("notes")

        if not items:
            await params.result_callback(
                {"ok": False, "reason": "There are no items on the order yet."}
            )
            return
        if fulfillment == "delivery" and not delivery_address:
            await params.result_callback(
                {
                    "ok": False,
                    "reason": "I need a delivery address before I can place a delivery order.",
                }
            )
            return

        p_items: list[dict] = []
        confirmed: list[dict] = []
        subtotal = Decimal("0")
        try:
            for it in items:
                name = (it.get("name") or "").strip()
                if not name:
                    continue
                qty = int(it.get("quantity") or 1)
                size = it.get("size")
                row = await resolve_item(client, restaurant_name, name, size)

                # Combos carry required side + appetizer modifiers; resolve them
                # to real options and fold their price deltas (e.g. Lo Mein
                # +$3.00) into the per-unit price. Totals are computed here and
                # trusted by place_order_atomic, so include the delta in the line.
                modifiers: list[dict] = []
                if is_combo(row.get("category_name")):
                    modifiers = await resolve_combo_modifiers(
                        client,
                        row["item_id"],
                        row["variant_id"],
                        side=it.get("side"),
                        appetizer=it.get("appetizer"),
                    )
                delta = sum(
                    (Decimal(m["price_delta"]) for m in modifiers), Decimal("0")
                )

                unit = Decimal(str(row["price"])) + delta
                line_total = unit * qty
                subtotal += line_total
                display_name = clean_name(row["item_name"])
                variant_name = row.get("variant_name") or "Regular"
                p_items.append(
                    {
                        "item_id": row["item_id"],
                        "item_variant_id": row["variant_id"],
                        "quantity": qty,
                        "unit_price": money(unit),
                        "line_total": money(line_total),
                        "display_name": display_name,
                        "variant_name": variant_name,
                        "modifiers": modifiers,
                    }
                )
                confirmed.append(
                    {
                        "name": display_name,
                        "size": None if variant_name == "Regular" else variant_name,
                        "quantity": qty,
                        "modifiers": [m["option_name"] for m in modifiers],
                    }
                )
        except OrderResolutionError as exc:
            await params.result_callback({"ok": False, "reason": str(exc)})
            return

        if not p_items:
            await params.result_callback(
                {"ok": False, "reason": "There are no items on the order yet."}
            )
            return

        tax = (subtotal * TAX_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total = subtotal + tax

        rpc_args = {
            "p_restaurant_id": restaurant_id,
            "p_call_id": call_id,
            "p_customer_name": customer_name,
            "p_customer_phone": customer_phone,
            "p_fulfillment_type": fulfillment,
            "p_delivery_address": delivery_address,
            "p_subtotal": money(subtotal),
            "p_tax": money(tax),
            "p_total": money(total),
            "p_notes": notes,
            "p_status": "pending",
            "p_items": p_items,
        }

        try:
            await client.rpc(PLACE_ORDER_RPC, rpc_args).execute()
        except Exception as exc:
            if "order_locked" in str(exc):
                await params.result_callback(
                    {
                        "ok": False,
                        "locked": True,
                        "reason": "That order is already being prepared and can't be changed. I can start a new separate order if you like.",
                    }
                )
                return
            logger.exception("place_order_atomic failed (call_id=%s)", call_id)
            await params.result_callback(
                {
                    "ok": False,
                    "reason": "Sorry, something went wrong placing the order. Could you try again?",
                }
            )
            return

        logger.info(
            "Order placed call_id=%s items=%d total=%s",
            call_id,
            len(p_items),
            money(total),
        )
        await params.result_callback(
            {
                "ok": True,
                "fulfillment": fulfillment,
                "items": confirmed,
                "subtotal": money(subtotal),
                "tax": money(tax),
                "total": money(total),
            }
        )

    return handle_place_order
