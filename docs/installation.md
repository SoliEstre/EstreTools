# Install and troubleshoot EstreTools

## Claude Code

Use the repository, which contains both the catalog and the plugin folders:

```text
/plugin marketplace add https://github.com/SoliEstre/EstreTools.git
/plugin install mdbrown@estretools
/plugin install md-in-pdf2md@estretools
```

`SoliEstre/EstreTools` is also accepted. Restart Claude Code, or run
`/reload-plugins` when the install summary offers it. The fully qualified commands
are `/mdbrown:mdbrown report.md` and `/md-in-pdf2md:pdf2md report.pdf`.

## Claude desktop / Cowork

In **Customize → Plugins → Add marketplace**, enter
`https://github.com/SoliEstre/EstreTools`. Select the `estretools` marketplace,
then install `mdbrown` or `md-in-pdf2md`. Use **Update** on that marketplace to
refresh its catalog. CLI commands above belong in Claude Code, not a chat message
or the Add marketplace URL field.

If repository import is unavailable in your environment, download the individual
plugin ZIP from [Releases](https://github.com/SoliEstre/EstreTools/releases/latest)
and use the plugin upload option. Each ZIP includes `.claude-plugin/plugin.json`
at its root. The whole repository ZIP is a marketplace, not a single plugin package.
The tools need Node at execution time; Mermaid additionally needs its optional
packages and a local Chrome/Edge/Chromium in the execution environment.

## Marketplace adds, but mdbrown is missing

Refresh the catalog first, then install the current lowercase identifier:

```text
/plugin marketplace update estretools
/plugin install mdbrown@estretools
```

If it is already installed, use `/plugin update mdbrown@estretools`, then restart
or reload plugins. Updating the marketplace and updating an installed plugin are
separate operations. Third-party marketplace auto-update may be disabled.

The July 2026 releases originally called this plugin **`mdBrown`**. Version 0.2.0
renamed its manifest, directory and catalog entry to **`mdbrown`**. A cached older
catalog only lists the old name, and settings using the old name need migration.
The 0.3.0 catalog adds `renames: { "mdBrown": "mdbrown" }`; Claude Code 2.1.193+
uses this to migrate existing settings automatically. On older clients, update
Claude Code or uninstall `mdBrown@estretools` and install `mdbrown@estretools`.
Managed organization settings need the administrator to update the identifier.

## Marketplace cannot be added or plugins cannot be found on disk

- Use the **repository URL** above. Do not enter a GitHub `/tree/`, `/blob/`,
  plugin subfolder, or `raw.githubusercontent.com/.../marketplace.json` URL.
  EstreTools uses `./plugins/...` sources. A direct JSON URL downloads only the
  catalog, so those plugin directories are absent.
- For a local checkout, select the `EstreTools` folder containing `.claude-plugin`,
  not its parent `EstreToolsMaster` and not `plugins/mdbrown`.
- Check `/plugin marketplace list` for `estretools` and the expected source. A
  different local marketplace with the same name can replace the registration.
  Re-add the repository URL to correct the source, then refresh and install.
- For a Git/HTTPS failure, run `git ls-remote https://github.com/SoliEstre/EstreTools.git`.
  This is a public repository; it does not require access to another private project.
  A connection/proxy/certificate error here needs a network or Git configuration fix.
- Organization marketplace allowlists and plugin policies can block custom
  repositories. Ask the administrator to allow this repository if the error names
  a policy. Repository files cannot override an organization policy.

## Findings from the 0.3.0 investigation

The public `main` before this release contained both plugins and passed
`claude plugin validate` for the marketplace and mdbrown on Claude Code 2.1.261.
The add/list failure was **not reproduced** in that configuration. Repository
history confirms the name change without migration metadata; the direct-JSON
installation limitation follows from the catalog's relative sources. These
are separate failure paths, not proof of which one caused an individual report.

0.3.0 adds migration metadata, concise searchable descriptions, explicit plugin
versions, case-sensitive path/version checks in CI, and separate uploadable ZIPs.
It preserves relative sources for broad Claude Code and Cowork compatibility.
When reporting a remaining failure, include the Claude product/version, exact
source you entered, and full error text.

References: [Claude Code marketplaces](https://code.claude.com/docs/en/plugin-marketplaces),
[Cowork plugin installation](https://claude.com/docs/cowork/guide/plugins).
