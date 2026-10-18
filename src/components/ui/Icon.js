import { useSettings } from '../../context/SettingsContext';
import { Feather } from '@expo/vector-icons';
import React from 'react';
export default function Icon({
  name,
  size = 20,
  color
}) {
  const {
    colors
  } = useSettings();
  return <Feather name={name} size={size} color={color ?? colors.ink} accessible={false} />;
}
