# Expanded native readiness screening

Completed on 20 September 2026 against the dedicated iPhone 16 Pro / iOS 26.5
simulator. These are bounded interface and accessibility probes, not saved-flow
performance results.

| Tool | Exact version | Result |
| --- | --- | --- |
| ios-simulator-mcp | 2.1.0 | Started, exposed 17 tools, found the simulator and returned a 6,940-character accessibility description. |
| Mobile MCP | 1.0.4 | Started, exposed 32 tools, found the simulator and listed 27 on-screen elements. |
| fb-idb | 1.1.7 | Worked from an isolated experiment virtual environment as the accessibility backend for ios-simulator-mcp. |

The machine's pre-existing user-level `idb` command initially failed because
`aiofiles` was missing. The probe did not modify that installation. It created
an ignored virtual environment under `runtime/tools/idb-venv` and reran the
same command successfully.

Mobile MCP required its iOS device agent. Version 0.0.26 was installed on the
dedicated simulator for the read-only element listing and removed immediately
afterward. No Vaultwealth data or application code changed.

The sanitized receipt is
`evidence/expanded-native-screening-2026-09-20.json`. A future performance
comparison would still need an equivalent saved Vaultwealth journey, reset,
relaunch verification, and a seeded defect. These probes do not replace the
Maestro baseline.
