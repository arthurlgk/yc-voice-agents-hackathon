"""Resolve spoken dish names to real ``menu_variant_listing`` rows.

A simplified subset of the Lin Garden agent's ``services/catalog.py``. We keep
the name-to-UUID resolution (needed because ``order_items.item_id`` and
``item_variant_id`` are NOT NULL foreign keys) and drop modifiers, promos, and
the cart model.

Menu facts this relies on (verified against staging):
- The ``menu_variant_listing`` view has no ``restaurant_id`` column, so we filter
  by the text ``restaurant_name``.
- A la carte item names carry no code prefix (``Beef w. Broccoli``) and come in
  Small/Large; combo names embed their code (``D25 General Tso's Chicken``) and
  come as a single ``Regular`` variant.
- Lunch Specials and Dinner Specials share no item names, so day-part only
  selects which special category is orderable now.
"""

import logging
import re
from datetime import datetime
from datetime import time as dt_time
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from supabase._async.client import AsyncClient

logger = logging.getLogger("restaurant.catalog")

VIEW = "menu_variant_listing"
EASTERN = ZoneInfo("America/New_York")

# Promotions are free auto-applied items customers cannot order by name; the
# special categories are the time-gated combos handled separately below.
NON_ORDERABLE_CATEGORIES = ("Promotions",)
COMBO_CATEGORIES = ("Lunch Specials", "Dinner Specials")

# Leading menu-code prefix on combo names, e.g. "D25 ", "H11 ", "L7 ".
_CODE_PREFIX_RE = re.compile(r"^[A-Z]{1,4}\d+[A-Z]?\s+")

_SIZE_ORDER = {"small": 0, "large": 1}


class OrderResolutionError(Exception):
    """Raised when an item cannot be resolved to a menu row.

    The message is customer-facing: the place_order handler returns it to the
    LLM so the agent can re-ask instead of placing a bad order.
    """


def escape_ilike(s: str) -> str:
    """Escape PostgREST ILIKE wildcards in caller-supplied text."""
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def money(x: Decimal) -> str:
    """Serialize a money Decimal to a 2dp string for the numeric columns."""
    return str(x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def clean_name(item_name: str) -> str:
    """Strip a leading menu-code prefix so names read naturally."""
    return _CODE_PREFIX_RE.sub("", item_name).strip()


def code_prefix(item_name: str) -> str | None:
    """Return the leading menu code (e.g. ``D25``) if the name embeds one."""
    m = _CODE_PREFIX_RE.match(item_name)
    return m.group(0).strip() if m else None


def current_day_part(now: datetime | None = None) -> str:
    """``"lunch"`` for 11:00 to 15:30 Eastern, otherwise ``"dinner"``."""
    now = now or datetime.now(EASTERN)
    return "lunch" if dt_time(11, 0) <= now.time() < dt_time(15, 30) else "dinner"


def _alacarte_query(client: AsyncClient, restaurant_name: str):
    q = client.table(VIEW).select("*").eq("restaurant_name", restaurant_name)
    q = q.not_.in_("category_name", NON_ORDERABLE_CATEGORIES)
    q = q.not_.in_("category_name", COMBO_CATEGORIES)
    return q


def _special_query(client: AsyncClient, restaurant_name: str, category: str):
    return (
        client.table(VIEW)
        .select("*")
        .eq("restaurant_name", restaurant_name)
        .eq("category_name", category)
    )


async def resolve_item(
    client: AsyncClient,
    restaurant_name: str,
    name: str,
    size: str | None = None,
) -> dict:
    """Resolve a spoken dish name (and optional size) to one menu row.

    Tries a la carte first (exact name, then substring), then the current
    day-part special category. Raises ``OrderResolutionError`` on a miss, on a
    genuine multi-dish ambiguity, or when a sized item needs a size.
    """
    pattern = escape_ilike(name.strip())

    rows = (
        await _alacarte_query(client, restaurant_name)
        .ilike("item_name", pattern)
        .execute()
    ).data
    if not rows:
        rows = (
            await _alacarte_query(client, restaurant_name)
            .ilike("item_name", f"%{pattern}%")
            .execute()
        ).data
    if not rows:
        category = (
            "Lunch Specials" if current_day_part() == "lunch" else "Dinner Specials"
        )
        rows = (
            await _special_query(client, restaurant_name, category)
            .ilike("item_name", f"%{pattern}%")
            .execute()
        ).data

    if not rows:
        raise OrderResolutionError(f"I don't see {name} on our menu.")

    rows = _narrow_to_one_dish(rows, name)
    return _select_variant(rows, name, size)


def _narrow_to_one_dish(rows: list[dict], name: str) -> list[dict]:
    """Reduce rows spanning several dishes to a single dish's variant rows."""
    if len({r["item_id"] for r in rows}) <= 1:
        return rows

    target = name.strip().lower()
    exact = [r for r in rows if clean_name(r["item_name"]).lower() == target]
    if exact:
        return exact

    if len({r["item_id"] for r in rows}) > 1:
        choices = sorted({clean_name(r["item_name"]) for r in rows})
        raise OrderResolutionError(
            "I found a few things matching that: "
            + ", ".join(choices[:4])
            + ". Which one would you like?"
        )
    return rows


def _select_variant(rows: list[dict], name: str, size: str | None) -> dict:
    """Pick the right variant row, asking for a size only when one is needed."""
    variants = {r["variant_name"]: r for r in rows if r.get("variant_name")}
    if len(variants) <= 1:
        return rows[0]

    ordered = sorted(variants, key=lambda v: _SIZE_ORDER.get(v.lower(), 99))
    if size:
        for vname, row in variants.items():
            if vname.lower() == size.strip().lower():
                return row
        raise OrderResolutionError(
            f"For {name} we have {' or '.join(ordered)}. Which size would you like?"
        )
    raise OrderResolutionError(
        f"{name} comes in {' or '.join(ordered)}. Which size would you like?"
    )


def is_combo(category_name: str | None) -> bool:
    """True for Lunch/Dinner Specials, the combos that carry side + appetizer."""
    return (category_name or "") in COMBO_CATEGORIES


def _match_option(options: list[dict], spoken: str) -> dict | None:
    """Map a caller's spoken choice to one modifier option, or None."""
    s = spoken.strip().lower()
    s_slug = s.replace(" ", "-")
    for o in options:
        if o["name"].lower() == s or o.get("slug", "").lower() == s_slug:
            return o
    for o in options:
        name = o["name"].lower()
        if s in name or name in s:
            return o
    return None


async def resolve_combo_modifiers(
    client: AsyncClient,
    item_id: str,
    variant_id: str,
    side: str | None = None,
    appetizer: str | None = None,
) -> list[dict]:
    """Resolve a combo's required side + appetizer choices to modifier rows.

    Walks ``item_modifier_groups`` -> ``modifier_groups`` -> ``modifier_options``
    for this combo variant and maps the caller's spoken ``side`` / ``appetizer``
    to real options. Returns dicts shaped like ``order_item_modifiers`` rows
    (``modifier_group_id``, ``modifier_option_id``, ``group_name``,
    ``option_name``, ``price_delta``) for the ``place_order`` payload.

    Falls back to a group's default option when the caller did not specify one
    (e.g. Pork Fried Rice for the side); raises ``OrderResolutionError`` when a
    required group has no default and no choice, so the agent re-asks. Only
    variant-scoped groups (Side Options, Appetizer Choice) are resolved; the
    item-scoped Protein Choice is out of scope for the simplified agent.
    """
    links = (
        await client.table("item_modifier_groups")
        .select("modifier_group_id")
        .eq("variant_id", variant_id)
        .execute()
    ).data
    group_ids = [link["modifier_group_id"] for link in links]
    if not group_ids:
        return []

    groups = (
        await client.table("modifier_groups")
        .select("id,name,slug,is_required,sort_order")
        .in_("id", group_ids)
        .order("sort_order")
        .execute()
    ).data

    spoken_by_slug = {"side-options": side, "appetizer-choice": appetizer}
    chosen: list[dict] = []
    for g in groups:
        opts = (
            await client.table("modifier_options")
            .select("id,name,slug,price_delta,is_default,sort_order")
            .eq("modifier_group_id", g["id"])
            .order("sort_order")
            .execute()
        ).data
        if not opts:
            continue

        spoken = spoken_by_slug.get(g["slug"])
        opt: dict | None = None
        if spoken:
            opt = _match_option(opts, spoken)
            if opt is None:
                names = ", ".join(o["name"] for o in opts[:6])
                raise OrderResolutionError(
                    f"For the combo {g['name'].lower()}, I have {names}. "
                    "Which would you like?"
                )
        if opt is None:
            opt = next((o for o in opts if o.get("is_default")), None)
        if opt is None and g.get("is_required"):
            names = ", ".join(o["name"] for o in opts[:6])
            raise OrderResolutionError(
                f"What would you like for the combo {g['name'].lower()}? "
                f"Options are {names}."
            )
        if opt is None:
            continue

        chosen.append(
            {
                "modifier_group_id": g["id"],
                "modifier_option_id": opt["id"],
                "group_name": g["name"],
                "option_name": opt["name"],
                "price_delta": money(Decimal(str(opt.get("price_delta") or 0))),
            }
        )
    return chosen
