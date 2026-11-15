# Libraries

Copied here unchanged, at a fixed version, so the site needs nothing from other servers when it runs.
Each was downloaded from the npm registry and checked against the registry's sha512 checksum.

| File | Package | Version | From the package | License |
|---|---|---|---|---|
| `preact.js` | preact | 10.29.8 | `dist/preact.module.js` | MIT, `LICENSE-preact.txt` |
| `preact-hooks.js` | preact | 10.29.8 | `hooks/dist/hooks.module.js` | MIT, `LICENSE-preact.txt` |
| `htm.js` | htm | 3.1.1 | `dist/htm.module.js` | Apache-2.0, `LICENSE-htm.txt` |
| `chart.umd.min.js` | chart.js | 4.5.1 | `dist/chart.umd.min.js` | MIT, `LICENSE-chart.js.txt` |

`index.html` maps the names `preact`, `preact/hooks` and `htm` to these files with an import map, and
loads Chart.js as a plain script that defines `Chart`.

To update one: download the new version from `https://registry.npmjs.org/<package>/-/<package>-<version>.tgz`,
check it against `dist.integrity` in `https://registry.npmjs.org/<package>/<version>`, copy the same file
from it, update this table, and check every page in a browser. Preact 11 (September 2026) changes some
details; read its release notes before moving to it.
