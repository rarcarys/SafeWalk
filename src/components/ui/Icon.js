import { colors } from '../../styles/theme';
import { Feather } from '@expo/vector-icons';
import React from 'react';
export default function Icon({
  name,
  size = 20,
  color = colors.ink
}) {
  return <Feather name={name} size={size} color={color} accessible={false} />;
}
