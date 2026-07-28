import { Text, Linking, StyleSheet } from 'react-native';

type Props = {
  text: string;
};

const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

export default function LinkedText({ text }: Props) {
  if (!text) return null;

  const parts = text.split(urlRegex);

  return (
    <Text style={styles.base}>
      {parts.map((part, index) => {
        const isLink = urlRegex.test(part);
        urlRegex.lastIndex = 0;

        if (!isLink) {
          return (
            <Text key={index} style={styles.base}>
              {part}
            </Text>
          );
        }

        const normalizedUrl = part.startsWith('http') ? part : `https://${part}`;

        return (
          <Text
            key={index}
            style={styles.link}
            onPress={() => Linking.openURL(normalizedUrl)}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2E7D32',
    textDecorationLine: 'underline',
  },
});