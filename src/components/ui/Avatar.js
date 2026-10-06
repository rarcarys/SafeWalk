import { people } from '../../data/contacts';
import { View, Text } from 'react-native';
import s from '../../styles/appStyles';
import React from 'react';
export default function Avatar({ person, small, large, initial }) {
  const data = people[person];
  return (
    <View
      style={[
        s.avatar,
        small && s.smallAvatar,
        large && s.largeAvatar,
        {
          backgroundColor: data.background,
        },
      ]}
    >
      <Text
        style={[
          s.avatarLetter,
          large && {
            fontSize: 27,
          },
          {
            color: data.foreground,
          },
        ]}
      >
        {initial || data.letter}
      </Text>
    </View>
  );
}
