"""CLI entry point.

  calsavers-remit bootstrap-oauth   — one-time: get a refresh token from Gusto
  calsavers-remit list-companies    — print companies this token can access
  calsavers-remit pull-recent       — pull last processed payroll, print rows
                                       relevant to CalSavers
"""

from __future__ import annotations

from datetime import date, timedelta

import typer
from rich.console import Console
from rich.table import Table

from . import __version__, config
from .gusto.client import GustoClient
from .gusto.oauth import bootstrap as oauth_bootstrap

app = typer.Typer(add_completion=False, no_args_is_help=True)
console = Console()


@app.command()
def version() -> None:
    """Print the package version."""
    console.print(__version__)


@app.command("bootstrap-oauth")
def bootstrap_oauth_cmd() -> None:
    """Run the one-time Gusto OAuth flow and write the refresh token to .env."""
    cfg = config.gusto()
    token = oauth_bootstrap(cfg)
    console.print(f"[green]Refresh token saved to .env[/] (len={len(token)})")


@app.command("list-companies")
def list_companies_cmd() -> None:
    """List companies this OAuth token can administer."""
    cfg = config.gusto()
    client = GustoClient(cfg)
    try:
        companies = client.list_companies()
    finally:
        client.close()
    table = Table(title="Gusto companies")
    table.add_column("UUID")
    table.add_column("Name")
    for c in companies:
        table.add_row(c.get("uuid", "?"), c.get("name", "?"))
    console.print(table)
    console.print(
        "\n[dim]Set GUSTO_COMPANY_UUID in .env to the company you want to remit for.[/]"
    )


@app.command("pull-recent")
def pull_recent_cmd(
    days: int = typer.Option(21, help="Look-back window (default 3 weeks)"),
) -> None:
    """Pull processed payrolls in the look-back window and show CalSavers-relevant deductions.

    Does NOT write any output file yet — that step is blocked on the real CalSavers
    contribution template being checked in to reference/contribution_template.xlsx.
    """
    cfg = config.gusto()
    if not cfg.company_uuid:
        raise typer.BadParameter(
            "GUSTO_COMPANY_UUID not set in .env. Run `make list-companies` first."
        )
    client = GustoClient(cfg)
    end = date.today()
    start = end - timedelta(days=days)
    try:
        payrolls = client.list_processed_payrolls(
            cfg.company_uuid, start.isoformat(), end.isoformat()
        )
        for payroll in payrolls:
            detail = client.get_payroll(cfg.company_uuid, payroll["payroll_uuid"])
            _print_payroll_calsavers_rows(detail)
    finally:
        client.close()


def _print_payroll_calsavers_rows(payroll: dict) -> None:
    check_date = payroll.get("check_date", "?")
    table = Table(title=f"Payroll {payroll.get('payroll_uuid', '?')[:8]} — check {check_date}")
    table.add_column("Employee UUID")
    table.add_column("Deduction")
    table.add_column("Amount", justify="right")
    found = 0
    for ec in payroll.get("employee_compensations", []):
        for deduction in ec.get("deductions", []) or []:
            name = (deduction.get("name") or "").lower()
            if "vestwell" in name or "calsavers" in name or "state ira" in name:
                table.add_row(
                    ec.get("employee_uuid", "?"),
                    deduction.get("name", "?"),
                    f"${deduction.get('amount', '0.00')}",
                )
                found += 1
    if found == 0:
        console.print(f"[yellow]No CalSavers-tagged deductions in payroll {check_date}[/]")
        return
    console.print(table)


if __name__ == "__main__":
    app()
