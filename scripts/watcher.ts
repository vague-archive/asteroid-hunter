import fs from "fs"
import path from "path"
import { Codegen } from "@vaguevoid/fiasco/tools"
import { build } from "./build"

const ROOT = path.join(__dirname, "..")
const DOT_FIASCO = path.join(ROOT, ".fiasco")
const FIASCO_GEN = path.join(DOT_FIASCO, "generated.ts")
const FIASCO_META_GEN = path.join(DOT_FIASCO, "meta.json")
const SRC = path.join(ROOT, "src")

if (!fs.existsSync(DOT_FIASCO)) {
  fs.mkdirSync(DOT_FIASCO)
}

Codegen.Watch({
  inDir: SRC,
  outFile: FIASCO_GEN,
  metaFile: FIASCO_META_GEN,
  onSuccess: build,
  debugLogs: true,
})
