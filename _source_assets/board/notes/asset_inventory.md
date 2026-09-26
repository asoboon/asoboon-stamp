# Board source asset inventory

Verified: 2026-09-26

The three supplied ZIP files were integrity-tested before extraction. Runtime does not read this directory; it reads only optimized WebP atlases from `miniapp-v2/develop/board/assets/`.

| Archive | SHA-256 | Extracted inventory | Runtime decision |
| --- | --- | ---: | --- |
| `POMPON_CHIRU_assets_draft_40 2.zip` | `535212a3b6f04de57e577be89620cfe3ab4c23d435ebdd472e2554f24defd8cf` | 40 manifested character PNGs, 3 unmanifested PNGs, manifest, README | 40 manifested images are the approved character source set |
| `effects_pack_v2.zip` | `3b82076b53bde7a960440b7804112a7d35fd5852eb7542c45345199d72b6c06b` | 67 clusters, 522 single parts, 6 previews, 3 original sheets, manifest, README | only the 20 semantically approved effects represented in the optimized atlas are eligible |
| `fourth_wall_implementation_pack_v1.zip` | `4e0185c3e85f3efe41e00dccc2d6a7a8fe6aa0b243dcd8270892c018a0db3fd4` | 80 implementation PNGs, 4 references, 7 previews, manifest, README | implementation layers are mapped into six fourth-wall atlases |

Extraction roots:

- `extracted/pompon_chiru/`: flattened character pack, without `__MACOSX` metadata
- `extracted/effects_pack_v2/`: original pack hierarchy preserved
- `extracted/fourth_wall/`: archive wrapper removed; category hierarchy preserved

No source PNG is loaded by the board page. No file was copied to Production.
