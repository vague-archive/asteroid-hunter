import path from "path"
import { Codegen } from "@vaguevoid/fiasco/tools"

const ROOT = path.join(__dirname, "..")
const DOT_FIASCO = path.join(ROOT, ".fiasco")
const FIASCO_GEN = path.join(DOT_FIASCO, "generated.ts")
const SRC = path.join(ROOT, "src")
const MAIN = path.join(SRC, "main.ts")
const DIST = path.join(ROOT, "modules")

const filter = new RegExp(`^${Codegen.FiascoGeneratedModuleId}$`)

export async function build() {
  const buildOut = await Bun.build({
    entrypoints: [MAIN],
    outdir: DIST,
    minify: false,
    sourcemap: "inline",
    publicPath: `${path.join(__dirname, "..", "modules")}/`,
    plugins: [
      {
        name: "Fiasco Bun Plugin",
        async setup(build) {
          build.onResolve({ filter }, () => ({ path: FIASCO_GEN.replaceAll("\\", "/") }))
        },
      },
    ],
  })

  console.log("Build Success: %o\n", buildOut.success)
}

build()
