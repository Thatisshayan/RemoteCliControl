module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  // jest-expo's default transformIgnorePatterns assumes a flat node_modules
  // layout ("node_modules/@react-native/js-polyfills/..."). Under pnpm,
  // react-native's own internal @react-native/* packages usually resolve
  // through the nested store instead ("node_modules/.pnpm/@react-native+js-
  // polyfills@0.76.3/node_modules/@react-native/js-polyfills/..."), which the
  // default pattern's negative lookahead treats as "not react-native" at the
  // first node_modules/ segment, so those Flow-typed files never get
  // Babel-transformed and Jest fails with a syntax error before any test
  // runs. Whitelisting ".pnpm/" as a pass-through here lets the regex fall
  // through to the second, real node_modules/@react-native/... segment,
  // where the existing package-name check applies normally.
  // "expo[^/]*/" and "@react-native[^/]*/" (rather than enumerating each
  // expo-* / @react-native-* package by name) so any expo/RN family package
  // already or later added as a dependency gets transformed without this
  // pattern needing an update every time.
  transformIgnorePatterns: [
    "node_modules/(?!\\.pnpm/|(jest-)?react-native[^/]*/|@react-native[^/]*/|expo[^/]*/|@expo[^/]*/|@expo-google-fonts/.*|react-navigation/|@react-navigation/.*|@unimodules/.*|unimodules/|sentry-expo/|native-base/)",
    "node_modules/react-native-reanimated/plugin/",
  ],
};
