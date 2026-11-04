# Sky Rush ✈️

A top-down plane shooter game for Android.

**Owner / Build by: Gm Anondo**

## ⬇️ Download APK

### [Download SkyRush.apk](https://github.com/synt4x-an0ndo/sky-rush/releases/latest/download/SkyRush.apk)

1. Tap the link above on your Android phone to download the APK.
2. Open the file. If asked, allow installing apps from this source.
3. Tap **Install** and play.

## How to play

- Drag to fly; your plane fires automatically.
- Complete missions and earn coins to buy and upgrade planes.

## Build from source

Requires Node.js, a JDK and the Android SDK. The art and music (about 370 MB) are not stored in git; generate them first with Python (numpy, scipy, Pillow, soundfile):

```
python tools/gen_terrain.py www/assets --chunks 32
python tools/gen_audio.py www/assets
python tools/gen_sprites.py www/assets .
```

```
npm install
npx cap sync android
cd android
gradlew assembleDebug
```

The APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.
