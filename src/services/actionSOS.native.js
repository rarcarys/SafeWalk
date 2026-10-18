import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export const actionSOS = Platform.OS === 'ios'
  ? requireOptionalNativeModule('SafeWalkSOS')
  : null;
