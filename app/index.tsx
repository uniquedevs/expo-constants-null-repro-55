import Constants from 'expo-constants';
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>expoConfig: {JSON.stringify(Constants.expoConfig, null, 2)}</Text>
      <Text>scheme: {Constants.expoConfig?.scheme ?? 'NULL'}</Text>
    </View>
  );
}