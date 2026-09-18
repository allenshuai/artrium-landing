`real-export-head.glb` is the first 20,396 bytes of the live exhibition asset
(`assets.artrium.space/VirtualGallery7_26.glb`, 244,499,180 bytes total) — its
12-byte header plus its complete 20,376-byte glTF JSON chunk, with the BIN chunk
omitted.

It is here because the importer only ever reads the JSON chunk, so this is a
faithful regression fixture for a real Blender export ("Khronos glTF Blender I/O
v5.2.39") at 0.008% of the size. It is deliberately **non-conformant**: the
designer has not adopted the `Artwork_<id>` naming contract yet, so the parser
must report it as unusable rather than silently returning an empty map. When the
exhibition is re-exported with conformant names, replace this file and update the
expectations in `../parseGlb.test.ts`.

Regenerate with:

    curl -s -r 0-20395 https://assets.artrium.space/VirtualGallery7_26.glb \
      -o real-export-head.glb

Synthetic fixtures are built in-memory by the test rather than committed as
binaries, so the naming cases under test are readable in the test source.
