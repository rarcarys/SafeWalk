import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export async function pickAvatar() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const size = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  context.crop({ originX: Math.floor((asset.width - size) / 2), originY: Math.floor((asset.height - size) / 2), width: size, height: size });
  context.resize({ width: 512, height: 512 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('Не удалось прочитать фото');
  return `data:image/jpeg;base64,${saved.base64}`;
}
