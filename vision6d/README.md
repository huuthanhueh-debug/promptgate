# Vision 6D

Take any image apart into **3D, 4D and 6D files** on your computer, and explore photos on six axes on your phone. Built with [three.js](https://threejs.org/), no dependencies, fully local: images never leave your machine.

[Tiếng Việt](README.vi.md) (full guide)

## Desktop app

Needs [Node.js](https://nodejs.org) 18+. Double-click `Vision6D.cmd` on Windows, run `./vision6d.sh` on macOS/Linux, or `node tools/desktop.js` anywhere. Drop images in (JPG, PNG, WebP, GIF, BMP, AVIF), preview them in **3D / 4D / 6D / Points**, press **Extract all**. Each image gets its own folder under `~/Vision6D` (`--out <folder>` to change).

| File | What it is |
|---|---|
| `model-3d.glb` | Textured relief mesh |
| `model-4d.glb` | 3D plus time: morph targets animated on an 8 s loop (emerge from the flat photo, tear into layers) |
| `model-6d.glb` | Each depth layer is its own node; the animation spreads them, then moves the stack on six axes (J1 yaw, J2 pitch, J3 roll, J4 x, J5 y, J6 z) |
| `points-6d.ply` | Point cloud, six values per point: x y z r g b |
| `layers/layer-N.png` | Transparent cut-outs, far to near |
| `depth.png`, `normal.png` | Depth map (white = near) and tangent-space normal map |
| `anatomy.glb` | Skeleton, organs and vessels fitted to the person (only when one is found) |
| `photo.jpg`, `scene.json` | Normalised source and a description of settings and files |

GLB files open in Windows 3D Viewer, Blender, PowerPoint and any glTF viewer; PLY in MeshLab, CloudCompare and Blender.

## Mobile app (Android)

Take or pick a photo and move it on six axes by touch, sliders or gyroscope; photos of a person get a labelled anatomy overlay. Offline, CAMERA permission only. The APK is built by CI: download the `vision6d-apk` artifact from the latest Actions run.

## Limits

- Depth is **estimated** from a single image (focus, position, brightness). It is not measured and no ML model is used. Load your own depth map for accurate results.
- Person detection is a skin-tone and posture heuristic.
- The anatomy model is a generic illustration, not derived from the person in the photo and not for medical use.
- The desktop app needs Node.js and a Chromium-based browser; there is no `.exe` installer yet.

## Develop

```bash
node tests/run.js           # every Node-only suite
node tests/desktop-e2e.js   # drives the desktop app in Chromium (needs Playwright)
node tests/mobile-e2e.js    # drives the mobile app in Chromium (needs Playwright)
node tools/build.js --apk   # builds the APK (JDK 17+, Android SDK, ANDROID_HOME)
```

MIT. three.js is © its authors, MIT (`core/vendor/THREE-LICENSE`).
