# Reference to interface mapping

Inspected 2026-10-08. Actual source revisions recorded; owner approved retained third-party application terms on 2026-10-09. These are implementation choices, not acceptance evidence.

| Reference | Concrete application | Verification |
| --- | --- | --- |
| BG0 420442c016eafb5fc76c66c56b6bacf191c61ed7 | Single image work area, drop/select, stage progress, preview and export adjacent; source inspected | Real file through processing and export, inspect result pixels |
| Rare UI b4de46efe4eb2613e22bb8134b482ed4e0c7736a | Tactile neutral controls, compact segmented navigation, focusable actions, adapted components only where useful; editor controls match it | Compare rendered image hierarchy, keyboard/touch access, source attribution |
| shadcn 4.21.4, b1VlJBjs | Official decoded Luma, neutral theme, Figtree, Hugeicons; exact registry light/dark variables in theme.css | Preserve registry tokens; typography and contrast inspection |
| Animate UI efeb96ffd7a3b7a4868667e4ac3c346620fb3044 | Brief press and panel fade; use compatible Motion dependency; reduced motion | No delay in execution; reduce-motion state inspection |
| Owner references, 2026-10-09 | Dark monochrome, restrained type, sparse static point texture; original aster mark dissolves into fine particles. Existing Luma dark variables remain exact. No copied figure, logo or reference assets. | Desktop/mobile hierarchy and contrast; texture never overlays a user image or obscures errors |
| Effect.app | Later Art reference only | No Art launch dependency |

Primary sources: [Rare UI source/license](https://github.com/swamimalode07/rare-ui/tree/b4de46efe4eb2613e22bb8134b482ed4e0c7736a), [Animate UI source/license](https://github.com/imskyleen/animate-ui/tree/efeb96ffd7a3b7a4868667e4ac3c346620fb3044), [official preset CLI](https://ui.shadcn.com/docs/cli), [BG0](https://github.com/opencoredev/bg0).

Rare UI catalog has no image-mask brush, image comparison, export settings, crop, batch queue or model cache manager. Build those product controls to match Rare UI. Do not add decorative components solely to make a library quota. Its license permits use in an application but restricts redistribution of component libraries; retain notices and visible credit with the retained terms approved by the owner. Animate UI similarly restricts component redistribution. Original Superaster code remains Apache-2.0; no relabeling imported code as Apache.
