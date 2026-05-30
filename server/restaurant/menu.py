"""Read the live menu from Supabase and render it as KV-markdown.

One read of the ``menu_variant_listing`` view replaces the Lin Garden agent's
five-query menu builder, because the simplified hackathon agent drops modifiers,
promos, and availability rules. The markdown is embedded in the system prompt so
the model answers all menu questions from context with no lookup tool.
"""

import logging
from collections import OrderedDict
from decimal import Decimal

from supabase._async.client import AsyncClient

from restaurant.catalog import (
    NON_ORDERABLE_CATEGORIES,
    VIEW,
    clean_name,
    code_prefix,
)

logger = logging.getLogger("restaurant.menu")

_LEGEND = (
    "Each item below is a record. `price` means a single size. `sm_price` and "
    "`lg_price` mean two sizes, so ask the customer for Small or Large when both "
    "are present. `code` is the menu number the customer may use. `spicy: yes` "
    "means warn the customer before confirming. Items under Lunch Specials and "
    "Dinner Specials are time-of-day combos; just take the dish name and the "
    "right pricing is applied automatically."
)


def _price(row: dict) -> str:
    return f"{Decimal(str(row['price'])):.2f}"


async def get_menu_markdown(client: AsyncClient, restaurant_name: str) -> str:
    """Return the full orderable menu for ``restaurant_name`` as KV-markdown."""
    q = (
        client.table(VIEW)
        .select(
            "category_name,item_id,external_code,item_name,is_hot_and_spicy,"
            "variant_id,variant_name,variant_type,price"
        )
        .eq("restaurant_name", restaurant_name)
        .not_.in_("category_name", NON_ORDERABLE_CATEGORIES)
        .order("category_name")
        .order("item_name")
        .order("variant_name")
    )
    rows = (await q.execute()).data
    markdown = _build_markdown(restaurant_name, rows)
    logger.info(
        "Built menu markdown: %d rows, %d chars", len(rows), len(markdown)
    )
    return markdown


def _build_markdown(restaurant_name: str, rows: list[dict]) -> str:
    # category -> item_name -> [variant rows], preserving query order.
    cats: OrderedDict[str, OrderedDict[str, list[dict]]] = OrderedDict()
    for r in rows:
        cats.setdefault(r["category_name"], OrderedDict()).setdefault(
            r["item_name"], []
        ).append(r)

    lines: list[str] = [f"# {restaurant_name} Menu", "", _LEGEND, ""]
    for category, items in cats.items():
        lines.append(f"## {category}")
        lines.append("")
        for item_name, variants in items.items():
            lines.append(f"### {clean_name(item_name)}")
            lines.append("```")
            code = code_prefix(item_name) or (variants[0].get("external_code") or "")
            if code:
                lines.append(f"code: {code}")
            lines.append(f"category: {category}")
            by_size = {v.get("variant_name"): v for v in variants}
            if "Small" in by_size and "Large" in by_size:
                lines.append(f"sm_price: ${_price(by_size['Small'])}")
                lines.append(f"lg_price: ${_price(by_size['Large'])}")
            else:
                lines.append(f"price: ${_price(variants[0])}")
            lines.append(
                f"spicy: {'yes' if variants[0].get('is_hot_and_spicy') else 'no'}"
            )
            lines.append("```")
            lines.append("")
    return "\n".join(lines) + "\n"
