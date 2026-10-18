const sharp = require('sharp');
const presets = require('../src/data/avatars.json');

async function normalizeAvatar(value) {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('Выберите изображение или готовый аватар');
  if (presets.some(item => value === `preset:${item.id}`)) return value;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > 1400000) throw new Error('Выберите фото JPG, PNG или WebP размером до 1 МБ');
  const input = Buffer.from(match[2], 'base64');
  if (input.length > 1024 * 1024 || input.toString('base64') !== match[2]) throw new Error('Изображение слишком большое или повреждено');
  try {
    // Decode, crop, strip metadata and store only a small normalized JPEG.
    const image = await sharp(input, { limitInputPixels: 16000000, failOn: 'warning' }).rotate().resize(256, 256, { fit: 'cover' }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${image.toString('base64')}`;
  } catch { throw new Error('Не удалось прочитать изображение. Выберите другое фото.'); }
}
module.exports = { normalizeAvatar };
