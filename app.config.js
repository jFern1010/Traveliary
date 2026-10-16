// Wraps app.json. Expo Go only loads EAS Updates labelled with its own SDK runtime
// ("exposdk:<version>"), while real builds use the "appVersion" policy from app.json.
// Publish an update for Expo Go testers with:  EXPO_GO_UPDATE=1 npx eas-cli@latest update ...
const { version: sdkVersion } = require('expo/package.json');

module.exports = ({ config }) =>
  process.env.EXPO_GO_UPDATE === '1'
    ? { ...config, runtimeVersion: `exposdk:${sdkVersion.split('.')[0]}.0.0` }
    : config;
