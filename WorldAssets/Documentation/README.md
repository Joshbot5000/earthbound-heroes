# World landmark asset library

Researched 2026-11-20 from `world_landmark_asset_tracker.xlsx` (126 landmarks).
The updated tracker is `Documentation/world_landmark_asset_tracker_UPDATED.xlsx`: see the Status column plus the
**Downloaded Assets** and **Review Required** sheets.

## What is here

| File | Landmark | Size | Triangles | Licence |
|---|---|---|---|---|
| Landmarks/Europe/France/EiffelTower/France_EiffelTower_CC0_Light.fbx | Eiffel Tower | 2.19 MB | 19,251 | CC0 |
| Landmarks/Europe/Italy/Colosseum/Italy_Colosseum_CC0_Light.fbx | Colosseum | 2.23 MB | 23,094 | CC0 |
| Landmarks/Europe/Italy/LeaningTowerOfPisa/Italy_LeaningTowerOfPisa_CC0_Light.fbx | Leaning Tower of Pisa | 2.52 MB | 23,026 | CC0 |
| Landmarks/Europe/Germany/NeuschwansteinCastle/Germany_NeuschwansteinCastle_CC0_Light.fbx | Neuschwanstein Castle | 2.30 MB | 28,274 | CC0 |
| Landmarks/Europe/UnitedKingdom/Stonehenge/UnitedKingdom_Stonehenge_CC0.fbx | Stonehenge | 1.80 MB | 15,642 | CC0 |
| Landmarks/Europe/Netherlands/CanalHouse/Netherlands_AmsterdamCanalHouse_CC0_Light.fbx | Amsterdam canal house (generic) | 2.34 MB | 21,447 | CC0 |
| Landmarks/Europe/Netherlands/Windmill/Netherlands_Windmill_CC0.fbx | Dutch windmill (generic) | 2.49 MB | 17,420 | CC0 |
| Landmarks/Africa/Egypt/Pyramid/Egypt_PyramidGiza_Stylised_CC0.fbx | Pyramid (generic, not a Giza replica) | 1.82 MB | 18,624 | CC0 |

Total: about 17.7 MB. All come from Grab3D. Each model page and the `LICENSE.txt` inside each package state
CC0 1.0: no attribution, commercial use allowed. Copies of each licence and manifest are in `LicenceRecords/`, with a summary in
`LicenceRecords/licence_register.csv`.

The models are **stylised**, not photoreal. Each FBX is binary, with its textures embedded (1K for the light versions, 2K for
Stonehenge, the windmill and the pyramid), in real-world metres and Y-up. All 8 loaded with the three.js FBX loader, and their sizes
matched the pages. They have **not** been opened in Unreal yet; there is no UE5 project on this machine.

`ReviewRequired/` holds a list only: 56 landmarks where the best free model is CC BY (credit required). Nothing there
has been downloaded.

## Importing into Unreal Engine 5

1. Copy the `Landmarks` folder somewhere outside your project, keeping the country folders.
2. In the Content Browser create `Content/WorldAssets/Landmarks/<Region>/<Country>/<Landmark>/` (same layout as here).
3. Drag the FBX into that folder. In the FBX import dialog:
   - Mesh: Static Mesh, **Combine Meshes on**, Generate Missing Collision on (or set it up yourself later, see step 5).
   - Transform: Import Uniform Scale **1.0**, leave rotation at 0. Then check the Eiffel Tower is about 330 m tall
     (33,000 units). If it comes in 100x too small or large, re-import with scale 100 or 0.01.
   - Materials: **Create New Materials**, Import Textures on. One set of materials per landmark, so don't tick
     "Search and Replace" across landmarks.
4. Open the mesh and check the ground plane sits at Z = 0. If it's lying on its side, re-import with Import Rotation X = 90.
5. Big walk-in models (Colosseum, Neuschwanstein): set Collision Complexity to "Use Complex As Simple", or add simple
   boxes, so players can't walk through walls.
6. Turn on Nanite for each mesh (Mesh editor, Nanite Settings, Enable). It costs little at these triangle counts and helps
   with distant views.
7. For a test area, make a new level `Content/WorldAssets/Maps/LandmarkShowcase`. Place the 8 meshes about 400 m apart
   on a flat plane with a Sky Atmosphere and a Directional Light. Leave your main map alone until you're happy with them.

GLB versions of the same files are also free on each Grab3D page (smaller, good for the web version of
Earthbound Heroes). Their direct links are in the tracker.
