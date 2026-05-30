"""System-prompt assembly for the restaurant agent.

The receptionist instructions are templated with the current Eastern time and
then the live menu markdown is appended, so the model answers menu questions
from context. ``load_initial_user_message`` returns the seed user turn that
tells the LLM what greeting to open with — keeping the greeting copy next to
the rest of the receptionist's voice rather than buried in pipeline wiring.
"""

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_PROMPTS_DIR = Path(__file__).parent


def load_receptionist_prompt(
    menu_markdown: str,
    current_time: str | None = None,
) -> str:
    """Return the full system prompt: instructions + the live menu markdown."""
    if current_time is None:
        now = datetime.now(ZoneInfo("America/New_York"))
        current_time = now.strftime("%A, %B %d, %Y %I:%M %p %Z")

    instructions = (_PROMPTS_DIR / "receptionist.md").read_text()
    return instructions.format(current_time=current_time) + "\n\n" + menu_markdown


def load_initial_user_message() -> str:
    """Return the seed user turn used to kick off the conversation.

    The receptionist prompt says "you have already greeted the caller"; this
    seed message is what gives the LLM the greeting it should have just said.
    Keep the greeting copy in ``greeting.md`` so persona / brand / language edits
    don't require touching ``bot.py``.
    """
    greeting = (_PROMPTS_DIR / "greeting.md").read_text().strip()
    return f"A customer just called. Greet them: '{greeting}'"
