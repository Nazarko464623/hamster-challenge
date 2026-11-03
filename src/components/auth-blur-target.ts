import { createRef, type ComponentRef } from 'react';
import { View } from 'react-native';

export const welcomeBlurTarget = createRef<ComponentRef<typeof View>>();
