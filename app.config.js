module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), ['expo-image-picker', { photosPermission: 'Выберите фото для аватара SafeWalk.', cameraPermission: false, microphonePermission: false }]],
  extra: { ...config.extra, ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } : {}) },
});
