module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), ['expo-image-picker', {
    photosPermission: 'Разрешите SafeWalk выбрать фотографию для аватара.',
    cameraPermission: 'Разрешите SafeWalk сделать фотографию для аватара.',
    microphonePermission: false,
  }]],
  extra: { ...config.extra, ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } : {}) },
});
