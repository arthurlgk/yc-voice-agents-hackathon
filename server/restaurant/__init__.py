"""Restaurant phone-ordering business logic for the YC Hackathon agent.

This package is self-contained. It reads the live menu from Supabase, resolves
spoken dish names to real menu rows, and writes orders and a call record back to
Supabase. The Pipecat pipeline in ``bot.py`` wires these modules together.
"""
