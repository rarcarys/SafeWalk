import { StyleSheet } from 'react-native';

export function createScaledStyles(styles, fontScale) {
  const scaled = {};
  for (const [name, style] of Object.entries(styles)) {
    scaled[name] = { ...style };
    for (const property of ['fontSize', 'lineHeight']) {
      if (typeof style[property] === 'number') {
        scaled[name][property] = Math.round(style[property] * fontScale * 10) / 10;
      }
    }
  }
  return StyleSheet.create(scaled);
}
