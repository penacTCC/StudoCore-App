import { View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { useState } from 'react';
import { SplashScreen } from 'expo-router';
import { HADES } from '@/constants/hades';

export function LoadingScreen() {
  const [isAnimationDone, setIsAnimationDone] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: HADES.bg, alignItems: 'center', justifyContent: 'center' }}>
      <LottieView
        source={require('../../assets/animations/Book Loader.json')}
        autoPlay
        loop
        style={{ width: 200, height: 200 }}
        onAnimationFinish={() => setIsAnimationDone(true)}
        onLayout={async () => {
          await SplashScreen.hideAsync();
        }}
      />
      <Text className="text-slate-300 mt-4 text-lg font-semibold">
        Preparando seus estudos...
      </Text>
    </View>
  );
}