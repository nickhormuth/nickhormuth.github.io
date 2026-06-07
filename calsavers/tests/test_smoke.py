from calsavers_remit import __version__


def test_version() -> None:
    assert __version__ == "0.1.0"


def test_cli_imports() -> None:
    from calsavers_remit import cli

    assert cli.app is not None
