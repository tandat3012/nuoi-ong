module.exports = ({ config }) => {
  const arm64Only = process.env.MOBILE_ANDROID_ARM64_ONLY === 'true';
  const compactRelease = process.env.MOBILE_COMPACT_RELEASE === 'true';
  if (!arm64Only && !compactRelease) return config;

  // EAS resolves the config locally before fetching project environment values.
  // Validate them on the build worker, where the preview environment is present.
  if (compactRelease && process.env.EAS_BUILD === 'true') {
    for (const name of ['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'EXPO_PUBLIC_API_BASE_URL']) {
      if (!process.env[name]?.trim()) {
        throw new Error(`${name} is required in the EAS preview environment for the standalone APK`);
      }
    }
    const apiUrl = new URL(process.env.EXPO_PUBLIC_API_BASE_URL);
    if (['localhost', '127.0.0.1', '10.0.2.2'].includes(apiUrl.hostname)) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL must be reachable from the phone, not localhost');
    }
    if (!process.env.GOOGLE_SERVICES_JSON?.trim()) {
      throw new Error('GOOGLE_SERVICES_JSON file variable is required for Android push notifications');
    }
  }

  return {
    ...config,
    android: compactRelease
      ? {
          ...config.android,
          googleServicesFile: process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
        }
      : config.android,
    plugins: [
      ...(config.plugins ?? []),
      ['expo-build-properties', {
        android: arm64Only
          ? { buildArchs: ['arm64-v8a'] }
          : {
              enableMinifyInReleaseBuilds: true,
              enableShrinkResourcesInReleaseBuilds: true,
              useLegacyPackaging: true,
              usesCleartextTraffic: process.env.MOBILE_API_ALLOW_HTTP === 'true',
            },
      }],
    ],
  };
};
