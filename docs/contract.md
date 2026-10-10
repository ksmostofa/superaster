# Operation contract draft 1.0

Status: draft, not gate-frozen. JSON schemas are generated from central TypeBox definitions and TypeScript types are inferred from the same definitions. All adapters validate unknown parameters and unsupported operations before execution.

Coordinates use current orientation-normalized pixels, top-left origin, integer rectangles, exclusive right/bottom bounds. Crops cannot extend outside the image. EXIF normalization occurs exactly once on decode. Rotation is clockwise, expands bounds, and uses explicit transparent/default fill. Horizontal flip reflects left/right, vertical top/bottom. Pixel ceilings apply before decode and after every geometry step.

Images are RGBA in sRGB, alpha is foreground coverage, mask is 8-bit grayscale with 255 foreground. Inference consumes oriented RGB normalized by 1/255 then ImageNet mean/std, subject to approved artifact metadata. No hard threshold is applied to output alpha. Mask upsampling is declared interpolation, not recovered detail. RGB cleanup and alpha refinement require independent evidence.

Contain preserves ratio and pads. Cover preserves ratio and crops. Fill explicitly stretches. Canvas is exact width/height; positioning defaults center. Resize defaults contain without upscaling; requested dimensions remain exact when both are supplied by explicit pad. Supplied background files are explicit bound references. JPEG export fails if any transparency remains, requiring an explicit opaque composition. Encoding byte caps search quality under fixed geometry and fail if impossible. No implicit resize or format substitution.

Correction masks specify absolute output alpha, capped by the corresponding original-source alpha. Reapplying an exported mask preserves coverage, including partially transparent source pixels. Corrections operate on a separate coverage mask; restore uses the corresponding normalized original-source pixels. Corrected source coordinates follow prior geometry consistently. Undo/redo stores exact mask state in the editor. Print rounding is nearest integer `mm*dpi/25.4`; fixed grids fail if placements cannot fit. DPI is actual encoding metadata, not an inferred printer promise.

Source files are never overwritten without explicit authorization; outputs and execution records carry hashes and resolved settings. Default metadata strips source EXIF/XMP and sensitive data. Encoders may emit normalized orientation and density tags needed for sRGB or physical print dimensions. Metadata preservation requires explicit request and implementation support. Engine/quality pins never fall back silently. Unsupported quality/backend returns a choice/error.

Progress reports observed stages and byte counts only. Cancellation stops new scheduling and returns at a safe kernel boundary; browser worker termination is permitted to interrupt computation. Completed outputs survive. A serial warmed session is the initial concurrency limit pending measurement. Resume verifies input, resolved recipe, output hash before reuse; collision planning precedes writes.

Numeric tolerances and measured budgets are pending G2/G3 evidence. No release support is claimed by this draft.

Catalog resolution through the CLI, MCP and WebMCP returns `{preset, notices}`. The SDK retains `resolvePreset` for a profile alone and exposes `resolvePresetStatus` for the same explicit notices. Published rules and version pins stay unchanged; current freshness observations and newer-version notices are separate from those rules.
