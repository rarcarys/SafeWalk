const MAX_SOURCE_SIZE = 5 * 1024 * 1024;

export function pickAvatar(source = 'gallery') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.display = 'none';
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    let settled = false;
    if (source === 'camera') input.capture = 'environment';
    input.oncancel = () => setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, 500);
    input.onchange = async () => {
      if (settled) return;
      settled = true;
      const file = input.files?.[0];
      if (!file) { cleanup(); return resolve(null); }
      if (file.size > MAX_SOURCE_SIZE) { cleanup(); return reject(new Error('Выберите фото размером до 5 МБ')); }
      const url = URL.createObjectURL(file);
      try {
        const image = new Image(); image.src = url; await image.decode();
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, 512, 512);
        context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 512, 512);
        resolve({ uri: canvas.toDataURL('image/jpeg', 0.85), width: image.naturalWidth, height: image.naturalHeight, fileSize: file.size });
      } catch { reject(new Error('Не удалось прочитать изображение. Выберите другое фото.')); }
      finally { URL.revokeObjectURL(url); cleanup(); }
    };
    input.click();
  });
}
