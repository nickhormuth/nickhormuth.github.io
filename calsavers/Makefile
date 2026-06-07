SHELL := /bin/bash
.DEFAULT_GOAL := help

VENV := .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip

.PHONY: help install oauth list-companies pull-recent test lint redteam clean

help:
	@echo "Targets:"
	@echo "  install         Create .venv and install the project + dev deps"
	@echo "  oauth           Run the one-time Gusto OAuth bootstrap (writes refresh token to .env)"
	@echo "  list-companies  Print Gusto companies your token can access"
	@echo "  pull-recent     Pull the last processed payroll and print the CalSavers-relevant rows"
	@echo "  test            Run pytest"
	@echo "  lint            Run ruff"
	@echo "  redteam         Run codex red-team against design + code (requires local codex auth)"
	@echo "  clean           Remove venv and caches"

install:
	python3.11 -m venv $(VENV) 2>/dev/null || python3 -m venv $(VENV)
	$(PIP) install -U pip
	$(PIP) install -e ".[dev]"

oauth:
	$(VENV)/bin/calsavers-remit bootstrap-oauth

list-companies:
	$(VENV)/bin/calsavers-remit list-companies

pull-recent:
	$(VENV)/bin/calsavers-remit pull-recent

test:
	$(VENV)/bin/pytest

lint:
	$(VENV)/bin/ruff check src tests

# Codex red-team. Requires `codex` on PATH and a working OpenAI auth on your machine.
# Override model/reasoning effort via: make redteam MODEL=gpt-5.5 EFFORT=high
MODEL  ?= gpt-5.5
EFFORT ?= high
redteam:
	@command -v codex >/dev/null || { echo "ERROR: codex CLI not installed. See https://developers.openai.com/codex"; exit 1; }
	codex review \
	  -c model="$(MODEL)" \
	  -c model_reasoning_effort="$(EFFORT)" \
	  "Red-team the CalSavers-Gusto automation in this directory. \
	   Review DESIGN.md, RED_TEAM_v0.1.md, RUNBOOK_GUSTO_DEV_APP.md, \
	   and all code under src/. Flag risks, scope creep, security issues, \
	   missing edge cases, and incorrect technical assumptions."

clean:
	rm -rf $(VENV) .pytest_cache .ruff_cache dist build *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} +
