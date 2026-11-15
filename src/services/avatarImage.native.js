import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SOURCE_SIZE = 5 * 1024 * 1024;

export async function pickAvatar(source = 'gallery') {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      const error = new Error('Нет доступа к камере');
      error.canOpenSettings = permission.canAskAgain === false;
      throw error;
    }
  }
  const options = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_SOURCE_SIZE) throw new Error('Выберите фото размером до 5 МБ');
  const size = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  context.crop({ originX: Math.floor((asset.width - size) / 2), originY: Math.floor((asset.height - size) / 2), width: size, height: size });
  context.resize({ width: 512, height: 512 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('Не удалось прочитать фото');
  return { uri: `data:image/jpeg;base64,${saved.base64}`, width: asset.width, height: asset.height, fileSize: asset.fileSize ?? null };
}
