import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import IconButton from './ui/IconButton';

export default function DurationInput({ value, onChange, disabled }) {
  const { appStyles: s, t } = useSettings();
  const [hours, setHours] = useState(String(Math.floor(value / 60)));
  const [minutes, setMinutes] = useState(String(value % 60));
  const focused = useRef(false);
  const sync = () => { setHours(String(Math.floor(value / 60))); setMinutes(String(value % 60)); };
  useEffect(() => { if (!focused.current) sync(); }, [value]);
  const edit = (text, isHours) => {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    const number = Math.min(isHours ? 24 : 59, Number(digits));
    if (isHours) setHours(digits === '' ? '' : String(number));
    else setMinutes(digits === '' ? '' : String(number));
    const total = isHours ? number * 60 + Number(minutes) : Number(hours) * 60 + number;
    onChange(Math.max(1, Math.min(1440, total)));
  };
  const field = (isHours) => <View style={s.durationField}>
    <TextInput accessibilityLabel={t(isHours ? 'Часы в пути' : 'Минуты в пути')} value={isHours ? hours : minutes} onChangeText={text => edit(text, isHours)} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; sync(); }} keyboardType="number-pad" inputMode="numeric" selectTextOnFocus maxLength={2} editable={!disabled} style={s.durationNumber} />
    <Text style={s.rowSubtitle}>{t(isHours ? 'ч' : 'мин')}</Text>
  </View>;
  return <View style={s.durationEditor}>
    <IconButton icon="minus" label={t('Уменьшить время на 5 минут')} disabled={disabled || value <= 1} onPress={() => onChange(Math.max(1, value - 5))} />
    {field(true)}<Text style={s.durationSeparator}>:</Text>{field(false)}
    <IconButton icon="plus" label={t('Увеличить время на 5 минут')} disabled={disabled || value >= 1440} onPress={() => onChange(Math.min(1440, value + 5))} />
  </View>;
}
