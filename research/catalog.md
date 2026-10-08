# Destination source review

Checked 2026-10-08 JST against active specification revision 1.1. Records are in `packages/catalog/data/presets.json`, version `2026-10-08.1`. This is source review and integration input, not a G6B result. No image has been certified for official acceptance.

## Decisions

Use original fact records released under CC0-1.0, with authority links. Import no third-party catalog. Government/platform wording, logos, example photos and diagrams are not redistributed as CC0. Exact rule text here is paraphrased. Runtime validation, review-state behavior and integrated output checks remain the coordinator's responsibility.

The five pilots are Washington Japan entry visa paper, ISA Japan residence/status paper, UK own-device digital passport, UK booth/shop digital passport, and Shopify square product images. The full draft contains 20 reviewed purpose/channel records, including supported still-output paths and original print grids. Multiple profiles from one source are channel or aspect variants, not claims of 20 different authorities or worldwide coverage.

## Reuse audit

| Candidate | Exact revision and inspected material | Decision and evidence |
| --- | --- | --- |
| [PhotoSpec](https://getphotospec.com/) | Live site on 2026-10-08; country/document chooser, shooting checklist, crop/adjust/export workflow. No source license established. | Use workflow reference only. Its UI and product claims are proprietary material and do not prove rule accuracy or demand volume. |
| [Hugging Face passport-photo-specs](https://huggingface.co/datasets/Whiterocket/passport-photo-specs) | Dataset revision `deb4e6ff8a39c67da6010c07c47a3e9c7c5b9608`, modified 2026-09-09. Card lists MIT and points to a different canonical repository than the original reference. | Do not import. Card's "no attribution required" statement does not remove MIT notice obligations. |
| [Actual canonical repository](https://github.com/BlondDev-Art/passport-photo-specs/tree/3d21b1d6e1656512c708faa53ffbea7bafefa263) | Git revision `3d21b1d6e1656512c708faa53ffbea7bafefa263`; package `1.4.0`; inspected `LICENSE`, `specs/specs.json`, `specs/index.ts`, `scripts/validate.js`. Dataset SHA-256 `ed00fac0ae46eeba01011a965a1b978bfa4a6a5df91097d51d2c78ca4b4dec44`; LICENSE SHA-256 `e2f9b2e2d31fa44425db54f972f3c99c8bdf4eb5133680041059f6c9faa9837d`. | MIT permits reuse with notice. Current JSON has country/document sizes and prose requirements; Japanese records inspected have no per-record `source_url`, channel or edit-policy fields despite the dataset card claim. Their single Japan-visa size cannot represent Washington's 2-inch-square instruction. Validation checks integrity and approximate geometry, not live authority rules. Build original richer records. |

The specification's `whitetirocket/passport-photo-specs` GitHub URL returned 404. This is a corrected research reference, not permission to replace the product requirement. No imported dataset records or executable package dependencies were added.

## Authority and channel review

Every link below was read through the web tool on 2026-10-08 except ISA's live HTML and dimension diagram, which were fetched directly and inspected after the web tool returned 403. Raw retrieval hashes, successful byte counts and failures are in `packages/catalog/data/source-retrievals.json`. A failed raw request can coexist with a successful web-tool read; monitoring must report its own failure as unknown freshness.

| Source and records | Sourced rules used | Unknowns, restrictions and implementation choices |
| --- | --- | --- |
| [Japan Embassy Washington short-term guidance](https://www.us.emb-japan.go.jp/itpr_en/visa-short-term-visit.html), page dated 2026-07-01; `jp-entry-visa-washington-paper` | 2×2 inches, plain background, age within six months, no filters, passport photo paper, glue-only attachment. | This is the Washington in-person paper channel. [MOFA's current general form](https://www.mofa.go.jp/files/000124525.pdf), reached from the [2026-06-24 visa index](https://www.mofa.go.jp/j_info/visit/visa/index.html), prints 45×35mm. Submitting-mission instructions control; do not default all Japan applications to either size. Source does not authorize background replacement/crop. Superaster blocks subject/background edits conservatively and leaves geometry unspecified. 300dpi is an output choice. |
| [ISA submitted-photo guidance](https://www.moj.go.jp/isa/applications/status/photo_info_00002.html) and [dimension diagram](https://www.moj.go.jp/isa/content/930002400.gif); `jp-residence-status-paper` | 30×40mm; head including hair 25±3mm; top margin 5±3mm; horizontal center 15±2mm. Only applicant, frontal, no background/shadows, clear, within six months, name on reverse unless procedure allows direct printing. | Appearance-changing retouching and horizontal reversal prohibited. Religious/medical coverings require clear face and statement. Do not remove coverings. Background/crop permission and online file limits are unspecified here. Indexed manuals `001452664.pdf` and `001453131.pdf` did not provide current retrievable evidence, so no online residence profile is published. |
| [UK digital passport guidance](https://www.gov.uk/photos-for-passports); `uk-passport-digital-own-device`, `uk-passport-digital-booth-shop` | Minimum 600×750; 50KB to 10MB; colour, clear, software-unaltered and new within one month. Portrait/background rules and child/religious/medical/glasses exceptions are recorded. | Own-device channel expressly forbids cropping and includes upper body; application crops it. Booth/shop channel uses a code. Both validate original input only. Formats and KB/MB basis are unspecified. No encoder recipe may silently alter the image. |
| [X upload guidance](https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo); avatar/header | Avatar recommendation 400-square, JPEG/PNG/GIF and profile cap 2MB. Header recommendation 1500×500; some displays crop top/bottom. | Header byte cap/type are not established by this page. Do not apply avatar 2MB cap to header. Source does not publish a complete edit policy. |
| [YouTube thumbnails](https://support.google.com/youtube/answer/72431?hl=en&isappinstalled=0); mobile/desktop video thumbnail | Current recommendation 3840×2160, minimum video width 640; JPEG/PNG and 16:9 recommended. Upload cap differs: mobile 2MB, desktop 50MB. | These are video-thumbnail channel variants. Shorts/podcasts are separate and absent. Legacy universal 1280×720/2MB assumptions are superseded. Account/content-policy confirmations are separate from pixel checks. |
| [YouTube branding](https://support.google.com/youtube/answer/10456525?hl=en); banner/profile/watermark | Banner minimum 2048×1152, 16:9, recommended 2560×1440, ≤6MB; safe area at minimum is 1235×338. Profile allows listed still formats, ≤15MB and renders 98-square. Watermark square, minimum 150-square, <1MB. | Profile display dimensions are not input dimensions. Watermark format is unspecified. Additional banner embellishments discouraged; placement needs visual review. Creating a supplied watermark image does not imply editing video. |
| [Shopify media](https://help.shopify.com/en/manual/products/product-media/product-media-types); square product | Maximum 5000×5000/25MP, <20MB; square 2048 recommended; accepted formats listed; consistent main-image ratios recommended. | Actual display depends on theme. White contain canvas is a Superaster example, not Shopify's mandated background. Runtime only exports approved PNG/JPEG/WebP subset. |
| [Etsy image requirements](https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop); listing/logo/big banner | Listing both dimensions ≥2000 recommended, first image ≥635 each recommended; logo 500-square recommended; big banner minimum 1200×300, recommended 1600×400. Listed formats, opaque PNG, sRGB guidance. | Source first permits landscape/square, later recommends avoiding square thumbnail crops. Preserve both recommendations and prefer a user-inspected landscape example. Above-1MB upload risk is not a hard cap. Accepted formats exceed MVP codec support. |
| [Google Article images](https://developers.google.com/search/docs/appearance/structured-data/article); 16:9/4:3/1:1 variants | Multiple images at these ratios and at least 50K pixels recommended; images representative, supported, crawlable/indexable. | 1600×900/1200×900/900-square are Superaster example sizes, not Google requirements. Current validator cannot establish crawlability from local pixels or guarantee search appearance. |
| [W3C length conversion](https://www.w3.org/TR/css-values-4/#absolute-lengths), [A4 page definition](https://www.w3.org/TR/css-page-3/#page-size); two print grids | One inch equals 25.4mm; A4 is 210×297mm. | Grid layouts/density below are original Superaster policies. Sources establish units/sheet definition, not official-photo eligibility. |

Dates shown are verification dates or page publication labels. No source here announced a separate effective date, so `effective_at` is absent rather than guessed.

## Original fixed-grid policy

These are convenience outputs using an already prepared item. They do not decide whether a photo can be edited or submitted to an authority. Resize is explicit through the grid operation. The item should have matching proportions; aspect mismatch must require a disclosed fit/crop choice or fail.

| Record | Sheet / item / layout | Pixel result at selected 300dpi |
| --- | --- | --- |
| `print-grid-4x6in-30x40mm` | 101.6×152.4mm sheet; 30×40mm item; 3 rows ×2 columns; 5mm margins and 5mm spacing | 1200×1800 sheet; 354×472 item; margin/spacing each round to 59px. Each item's top-left is `59 + column*(354+59), 59 + row*(472+59)`. |
| `print-grid-a4-35x45mm` | 210×297mm sheet; 35×45mm item; 5 rows ×4 columns; 10mm margins and 5mm spacing | 2480×3508 sheet; 413×531 item; margin 118px, spacing 59px. Top-left is `118 + column*(413+59), 118 + row*(531+59)`. |

Round each declared physical quantity to nearest pixel, using `round(mm*300/25.4)`. Record resolved sheet/item sizes, density and every placement. Print at actual size, disable fit-to-page and measure the result. Printer margins, scaling and physical output are user confirmations, not pixel passes.

## Verification and resolver policy

The coordinator's shared types distinguish mandatory/recommended rules. Missing facts remain unspecified in `edit_policy.notes`; they are not invented as mandatory constraints. Public records contain no guessed JPEG rule for UK, online ISA byte cap, universal white-background requirement, or official DPI requirement.

For ambiguous authority byte units, `value` is a conservative endpoint and `tolerance` is the ambiguity interval, not a relaxed acceptance threshold. For a maximum, pass at or below `value`, needs_review through `value+tolerance`, fail above that. For a minimum, pass at or above `value`, needs_review from `value-tolerance` up to `value`, fail below that. A strict "under" boundary subtracts one byte. The rule text states this interpretation. Recommended thresholds report recommendations; they do not certify approval. Physical-dimension checks use the inspected file's declared density. The selected example density does not reject another density that yields the correct physical size. Absent density is not_checked; actual-size printer output still needs confirmation.

Visual judgment stays `needs_review` unless a supported estimator with declared limits establishes it. The current source data does not add face detection, identity authentication, lighting measurement or paper inspection. Photo age, unchanged appearance, consent/exception eligibility, photo paper and printer settings are separate user confirmations. A good encode cannot turn any such item into a pixel pass.

Non-official `allowed` lists describe Superaster's user-requested faithful preparation policy. Where a platform does not state a complete editing policy, this is named in the record. For official profiles, unspecified operations need source/authority review; absence of a ban is not permission. UK unaltered validation needs preservation of original bytes, including a prohibition on ordinary re-encoding.

| Ambiguous request | Minimal material clarification |
| --- | --- |
| "Japan visa photo" | Entry visa at an overseas mission, or residence/status procedure in Japan? For entry, which submitting mission/channel? |
| "UK passport photo" | Own-device online image, booth/shop code, or printed application? Only the two digital channels are reviewed here. |
| "YouTube thumbnail" | Mobile or desktop upload? Their current byte caps differ. |
| "Article image" | Which variant, or all three for structured data? |
| "Photo sheet" | 4×6-inch/30×40mm grid or A4/35×45mm grid? |

Aliases deliberately overlap when a request is materially ambiguous. Exact ID/version bypasses interpretation. Old immutable records must remain accessible and show a newer-version notice. Source changes set `needs_review`; retrieval failure sets unknown freshness. Do not update a record in place after a published pin exists.

## Finite acceptance needed at integration

Data review supports the named prerequisite. The coding branch adds runtime record validation, exact/minimum geometry and file-property checks, immutable records/history, edit planning and a bounded sequential source monitor. Injected response fixtures are test-only; production monitoring uses actual fetches and cannot approve a new profile version.

On the identified catalog coding commit, `node_modules/.bin/vitest run tests/catalog.test.ts tests/contract.test.ts` passed 10 tests and `node_modules/.bin/tsc --noEmit` passed. Checks covered exact pins/material ambiguity, uncited/conflicting contributions, UK pixel minima, byte ambiguity windows, visual/confirmation separation, pixel opacity versus channel presence, physical density, forbidden/unspecified changes including hidden UK re-encoding, changed/failed sources, missing baselines and cancellation. Native build was initially blocked by the shared contract's default Ajv import under NodeNext; the coordinator owns that fix and must recheck it on the merged version.

G6B still requires integrated consumers, source scheduling/freshness propagation, immutable published update/newer-version behavior, real decoded print-sheet placement/density and actual exported files. T12-T15/T20 on the integrated release are NOT RUN by this lane. A coding unit pass does not award the gate.
