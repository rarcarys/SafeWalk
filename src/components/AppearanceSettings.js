import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { themeOptions, fontSizeOptions } from '../styles/theme';
import { languageOptions } from '../i18n';
import Icon from './ui/Icon';
import ModalSheet from './ui/ModalSheet';
import SettingsSection from './ui/SettingsSection';
import PreferenceRow from './ui/PreferenceRow';
import ActionButton from './ui/ActionButton';
import { createAppStyles } from '../styles/appStyles';

function ChoiceRow({ title, value, icon, onPress, last }) {
  const { appStyles: s, colors } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={value}
      onPress={onPress}
      style={({ pressed }) => [s.settingsChoiceRow, last && s.settingsLastRow, pressed && s.pressed]}
    >
      <Icon name={icon} size={20} color={colors.muted} />
      <View style={s.flex}>
        <Text style={s.settingsRowTitle}>{title}</Text>
        <Text style={s.settingsCurrentValue}>{value}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function AppearanceSettings({ compact = false }) {
  const { appStyles: s, colors, theme, setTheme, fontSize, setFontSize, language, setLanguage, storageError, t } = useSettings();
  const [picker, setPicker] = useState(null);
  const [draftFontSize, setDraftFontSize] = useState(fontSize);
  const previewScale = fontSizeOptions.find(option => option.value === draftFontSize).scale;
  const previewStyles = useMemo(() => createAppStyles(colors, previewScale), [colors, previewScale]);
  const openFontPicker = () => {
    setDraftFontSize(fontSize);
    setPicker('font');
  };
  const selectedTheme = themeOptions.find(option => option.value === theme);
  const selectedFont = fontSizeOptions.find(option => option.value === fontSize);
  const selectedLanguage = languageOptions.find(option => option.value === language);
  const themeHints = { light: 'Светлый фон и тёмный текст', dark: 'Тёмный фон и светлый текст' };
  const fontHints = { small: 'Для компактного отображения', normal: 'Стандартный размер', large: 'Для более удобного чтения' };
  const pickers = {
    theme: { title: 'Тема приложения', value: theme, options: themeOptions, change: setTheme, hints: themeHints },
    font: { title: 'Размер текста', value: fontSize, options: fontSizeOptions, change: setFontSize, hints: fontHints },
    language: { title: 'Язык приложения', value: language, options: languageOptions, change: setLanguage },
  };
  const active = pickers[picker];
  const overview = picker === 'overview';
  const choose = option => {
    if (picker === 'font') {
      setDraftFontSize(option.value);
      return;
    }
    active.change(option.value);
    setPicker(null);
  };
  return (
    <>
      {compact ? <PreferenceRow title={t('Оформление')} value={`${t(selectedTheme.label)} · ${selectedLanguage.label}`} icon="sliders" last onPress={() => setPicker('overview')} /> : <SettingsSection title={t('Оформление')} description={t('Тема, размер текста и язык.')} icon="sliders">
        <ChoiceRow title={t('Тема приложения')} value={t(selectedTheme.label)} icon={selectedTheme.icon} onPress={() => setPicker('theme')} />
        <ChoiceRow title={t('Размер текста')} value={t(selectedFont.label)} icon="type" onPress={openFontPicker} />
        <ChoiceRow title={t('Язык приложения')} value={selectedLanguage.label} icon="globe" last onPress={() => setPicker('language')} />
        <View style={s.settingsPreview}>
          <Text style={s.rowTitle}>{t('Так будет выглядеть текст')}</Text>
          <Text style={s.rowSubtitle}>{t('Планируйте маршруты и оставайтесь на связи с близкими.')}</Text>
        </View>
        {!!storageError && <Text role="alert" style={s.mapError}>{t(storageError)}</Text>}
      </SettingsSection>}
      <ModalSheet visible={!!active || overview} title={overview ? t('Оформление') : active ? t(active.title) : ''} onClose={() => setPicker(null)}>
        {overview && <>
          <PreferenceRow title={t('Тема приложения')} value={t(selectedTheme.label)} icon={selectedTheme.icon} onPress={() => setPicker('theme')} />
          <PreferenceRow title={t('Размер текста')} value={t(selectedFont.label)} icon="type" onPress={openFontPicker} />
          <PreferenceRow title={t('Язык приложения')} value={selectedLanguage.label} icon="globe" last onPress={() => setPicker('language')} />
          {!!storageError && <Text role="alert" style={s.mapError}>{t(storageError)}</Text>}
        </>}
        {active && (
          <>
            <View accessibilityRole="radiogroup" accessibilityLabel={t(active.title)} style={s.settingsOptions}>
              {active.options.map(option => {
                const selected = option.value === (picker === 'font' ? draftFontSize : active.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityLabel={t(option.label)}
                    accessibilityState={{ checked: selected }}
                    aria-checked={selected}
                    onPress={() => choose(option)}
                    style={({ pressed }) => [s.settingsOption, selected && s.settingsOptionSelected, pressed && s.pressed]}
                  >
                    <View style={s.settingsOptionIcon}>
                      {picker === 'font'
                        ? <Text style={[s.settingsFontSample, { fontSize: 22 * option.scale }]}>Aa</Text>
                        : <Icon name={option.icon || 'globe'} size={22} color={selected ? colors.selectedText : colors.muted} />}
                    </View>
                    <View style={s.flex}>
                      <Text style={s.settingsRowTitle}>{t(option.label)}</Text>
                      {!!active.hints && <Text style={s.settingsOptionDescription}>{t(active.hints[option.value])}</Text>}
                    </View>
                    <View style={[s.settingsRadio, selected && s.settingsRadioSelected]}>
                      {selected && <Icon name="check" size={13} color={colors.white} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {picker === 'font' ? <>
              <View style={s.settingsPreview}>
                <Text style={previewStyles.rowTitle}>{t('Так будет выглядеть текст')}</Text>
                <Text style={previewStyles.rowSubtitle}>{t('Планируйте маршруты и оставайтесь на связи с близкими.')}</Text>
              </View>
              <Text style={s.settingsPickerNote}>{t('Размер текста изменится после нажатия «Применить».')}</Text>
              <ActionButton title={t('Применить')} onPress={() => {
                setFontSize(draftFontSize);
                setPicker(null);
              }} />
              <ActionButton title={t('Отмена')} secondary onPress={() => setPicker(null)} />
            </> : <Text style={s.settingsPickerNote}>{t('Применяется сразу ко всем экранам.')}</Text>}
          </>
        )}
      </ModalSheet>
    </>
  );
}
