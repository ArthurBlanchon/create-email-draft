/**
 * Smoke test: the widget renders inside an emulated Grist, mounted as
 * `main.tsx` mounts it, with every column `GRIST_OPTIONS` declares mapped.
 *
 * It only reads `GRIST_OPTIONS`, so it stays valid as the widget changes,
 * and it improves with each SDK release. `.github/workflows/ci.yml` runs it
 * on every pull request, Dependabot's `grist-widget-sdk` updates included:
 * an SDK release that breaks this widget turns that PR red before the merge.
 * `smokeTestWidget()` stubs the browser APIs jsdom lacks (`ResizeObserver`,
 * `matchMedia`); a widget that needs more mocks them here.
 */
import { it } from "vitest"
import { smokeTestWidget } from "grist-widget-sdk/emulator/testing"

import App, { GRIST_OPTIONS } from "./App"

it("renders inside Grist with every declared column mapped", () =>
  smokeTestWidget({ App, options: GRIST_OPTIONS }))
