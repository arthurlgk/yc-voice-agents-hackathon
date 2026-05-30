"""Unit tests for combo modifier resolution (no network).

Mocks the Supabase async query builder so ``resolve_combo_modifiers`` can be
exercised against canned ``item_modifier_groups`` / ``modifier_groups`` /
``modifier_options`` rows. Async calls are driven with ``asyncio.run`` so no
pytest-asyncio plugin is needed.
"""

import asyncio

import pytest

from restaurant.catalog import (
    OrderResolutionError,
    _match_option,
    is_combo,
    resolve_combo_modifiers,
)

# --- fake Supabase query builder ----------------------------------------------


class _FakeResp:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows
        self._filters = {}

    def select(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def eq(self, col, val):
        self._filters[col] = ("eq", val)
        return self

    def in_(self, col, vals):
        self._filters[col] = ("in", vals)
        return self

    async def execute(self):
        rows = self._rows
        for col, (op, val) in self._filters.items():
            if op == "in":
                rows = [r for r in rows if r.get(col) in val]
            else:
                rows = [r for r in rows if r.get(col) == val]
        return _FakeResp(rows)


class _FakeClient:
    def __init__(self, tables):
        self._tables = tables

    def table(self, name):
        return _FakeQuery(self._tables.get(name, []))


def _client():
    return _FakeClient(
        {
            "item_modifier_groups": [
                {"variant_id": "V1", "item_id": "I1", "modifier_group_id": "GSIDE"},
                {"variant_id": "V1", "item_id": "I1", "modifier_group_id": "GAPP"},
            ],
            "modifier_groups": [
                {"id": "GSIDE", "name": "Side Options", "slug": "side-options",
                 "is_required": True, "sort_order": 1},
                {"id": "GAPP", "name": "Appetizer Choice", "slug": "appetizer-choice",
                 "is_required": True, "sort_order": 2},
            ],
            "modifier_options": [
                {"id": "OPFR", "modifier_group_id": "GSIDE", "name": "Pork Fried Rice",
                 "slug": "pork-fried-rice", "price_delta": 0.0, "is_default": True,
                 "sort_order": 1},
                {"id": "OLM", "modifier_group_id": "GSIDE", "name": "Lo Mein",
                 "slug": "lo-mein", "price_delta": 3.0, "is_default": False,
                 "sort_order": 3},
                {"id": "OEGG", "modifier_group_id": "GAPP", "name": "Egg Roll",
                 "slug": "egg-roll", "price_delta": 0.0, "is_default": False,
                 "sort_order": 1},
            ],
        }
    )


# --- is_combo / _match_option (pure) ------------------------------------------


def test_is_combo():
    assert is_combo("Lunch Specials")
    assert is_combo("Dinner Specials")
    assert not is_combo("Poultry")
    assert not is_combo(None)


def test_match_option():
    opts = [
        {"name": "Pork Fried Rice", "slug": "pork-fried-rice"},
        {"name": "Lo Mein", "slug": "lo-mein"},
    ]
    assert _match_option(opts, "Lo Mein")["slug"] == "lo-mein"
    assert _match_option(opts, "lo-mein")["slug"] == "lo-mein"
    assert _match_option(opts, "fried rice")["slug"] == "pork-fried-rice"
    assert _match_option(opts, "dumplings") is None


# --- resolve_combo_modifiers --------------------------------------------------


def test_lo_mein_side_carries_three_dollar_delta():
    mods = asyncio.run(
        resolve_combo_modifiers(_client(), "I1", "V1", side="Lo Mein", appetizer="Egg Roll")
    )
    by_group = {m["group_name"]: m for m in mods}
    assert by_group["Side Options"]["option_name"] == "Lo Mein"
    assert by_group["Side Options"]["price_delta"] == 3.0
    assert by_group["Appetizer Choice"]["option_name"] == "Egg Roll"
    assert by_group["Appetizer Choice"]["price_delta"] == 0.0


def test_side_defaults_to_pork_fried_rice_when_unspecified():
    mods = asyncio.run(
        resolve_combo_modifiers(_client(), "I1", "V1", side=None, appetizer="Egg Roll")
    )
    side = next(m for m in mods if m["group_name"] == "Side Options")
    assert side["option_name"] == "Pork Fried Rice"
    assert side["price_delta"] == 0.0


def test_missing_required_appetizer_raises():
    with pytest.raises(OrderResolutionError):
        asyncio.run(
            resolve_combo_modifiers(_client(), "I1", "V1", side="Lo Mein", appetizer=None)
        )


def test_invalid_side_choice_raises():
    with pytest.raises(OrderResolutionError):
        asyncio.run(
            resolve_combo_modifiers(_client(), "I1", "V1", side="Caviar", appetizer="Egg Roll")
        )


def test_non_combo_variant_has_no_modifiers():
    mods = asyncio.run(
        resolve_combo_modifiers(_client(), "I9", "V_NONE", side=None, appetizer=None)
    )
    assert mods == []
