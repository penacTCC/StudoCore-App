# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `AGENTS.md` at the repo root — that's the actual guidance (commands, architecture, rules), kept as a single shared file so other AI coding tools (e.g. DeepSeek) can read the same content if they support `AGENTS.md`. This file just points there so Claude Code's auto-load still finds something at `CLAUDE.md`.

## Codex / Gemini CLI config detected

A Codex config was found at `~/.codex/config.toml`. If you'd like to import its settings (MCP servers, instructions, etc.) into Claude Code, reply `/import` to scan what's importable, then `/import --yes=<digest>` to apply it.
