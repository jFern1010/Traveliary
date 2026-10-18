// Wraps app.json with values that must not be committed or that vary per build.
//
// 1. Expo Go only loads EAS Updates labelled with its own SDK runtime ("exposdk:<version>"),
//    while real builds use the "appVersion" policy from app.json.
//    Publish an update for Expo Go testers with:  EXPO_GO_UPDATE=1 npx eas-cli@latest update ...
// 2. The Android Google Maps key comes from the GOOGLE_MAPS_ANDROID_API_KEY environment variable
//    (EAS environment "preview"/"production" for cloud builds).
const { version: sdkVersion } = require('expo/package.json');

module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const plugins = [
    ...(config.plugins ?? []),
    ...(mapsKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey }]] : []),
  ];

  return {
    ...config,
    plugins,
    ...(process.env.EXPO_GO_UPDATE === '1'
      ? { runtimeVersion: `exposdk:${sdkVersion.split('.')[0]}.0.0` }
      : {}),
  };
};
