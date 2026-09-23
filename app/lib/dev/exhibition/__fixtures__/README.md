Two heads of real GLB files. Only the 12-byte header plus the glTF JSON chunk is
kept — the importer never reads past that, so these are faithful fixtures at a
fraction of the size. Full assets live in `.local-assets/` (gitignored); never
commit one.

**`real-export-head.glb`** — 20,396 bytes, from the live visitor asset
`assets.artrium.space/VirtualGallery7_26.glb` (244,499,180 bytes, "Khronos glTF
Blender I/O v5.2.39"). Deliberately **non-conformant**: it predates the naming
contract, so the parser must report it unusable rather than quietly returning an
empty map. Regenerate with:

    curl -s -r 0-20395 https://assets.artrium.space/VirtualGallery7_26.glb \
      -o real-export-head.glb

**`conformant-export-head.glb`** — 20,744 bytes, from
`gallery8_16-organized.glb` (298,225,456 bytes). The first export to follow the
contract: `Artwork_<kebab>`, `Room_<kebab>`, `Spawn_Main`, with artworks parented
under their room so `roomId` resolves. It also carries `Scenery_*` objects, which
are outside the contract and must be ignored without complaint. This is the
fixture that proves a clean export produces zero issues. Regenerate from a full
GLB with:

    python3 -c "
    import struct
    fh=open('../../../../../.local-assets/gallery8_16-organized.glb','rb')
    clen=struct.unpack('<I', fh.read(20)[12:16])[0]
    fh.seek(0); open('conformant-export-head.glb','wb').write(fh.read(20+clen))"

Synthetic cases (duplicate ids, collapsed `.001` suffixes, missing spawn) are
built in memory by `../parseGlb.test.ts` so they stay readable in the test source.
