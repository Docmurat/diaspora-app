import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();

  // Видимая область hero — нижняя граница фиксируется здесь
  const HERO_VIEWPORT_HEIGHT = height * 0.60;

  // Реальная высота картинки — может расти, но будет уходить вверх
  const HERO_IMAGE_WIDTH = width;
  const HERO_IMAGE_HEIGHT = HERO_IMAGE_WIDTH * 1.4;

  const LOGO_WIDTH = 300;
  const LOGO_HEIGHT = 150;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent />

      <View
        style={[
          styles.heroViewport,
          {
            height: HERO_VIEWPORT_HEIGHT,
          },
        ]}
      >
        <Image
          source={require('../assets/bg2.png')}
          style={[
            styles.heroImage,
            {
              width: HERO_IMAGE_WIDTH,
              height: HERO_IMAGE_HEIGHT,
            },
          ]}
        />
      </View>

      <View
        style={[
          styles.logoFloating,
          {
            top: HERO_VIEWPORT_HEIGHT - LOGO_HEIGHT * 0.75,
          },
        ]}
      >
        <Image
          source={require('../assets/logo.png')}
          style={{
            width: LOGO_WIDTH,
            height: LOGO_HEIGHT,
            resizeMode: 'contain',
          }}
        />
      </View>

      <View
        style={[
          styles.bottomSection,
          {
            paddingTop: LOGO_HEIGHT * 0.4,
            minHeight: Math.max(
              height - HERO_VIEWPORT_HEIGHT + LOGO_HEIGHT * 0.35,
              320
            ),
          },
        ]}
      >
        <Text style={styles.subtitle}>
          Закрытое сообщество взаимопомощи,{'\n'}
          полезных связей и поддержки
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Войти</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/invite')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Регистрация</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Только по приглашению</Text>

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
            <Text style={styles.linkText}>Политика конфиденциальности</Text>
          </TouchableOpacity>

          <Text style={styles.dot}>•</Text>

          <TouchableOpacity onPress={() => router.push('/terms' as any)}>
            <Text style={styles.linkText}>Пользовательское соглашение</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },

  // Фиксированная видимая зона hero
  heroViewport: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },

  // Картинка прижата к низу viewport
  heroImage: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    resizeMode: 'stretch',
  },

  logoFloating: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },

  bottomSection: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 28,
  },

  subtitle: {
    fontSize: 18,
    lineHeight: 31,
    textAlign: 'center',
    color: '#5C5C5C',
    marginBottom: 46,
    fontWeight: '400',
  },

  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 12,
  },

  secondaryButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '700',
  },

  footer: {
    textAlign: 'center',
    color: '#6E6E6E',
    fontSize: 15,
    marginTop: 4,
    marginBottom: 10,
  },

  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },

  linkText: {
    fontSize: 13,
    color: '#6E6E6E',
    textDecorationLine: 'underline',
  },

  dot: {
    marginHorizontal: 8,
    color: '#9A9A9A',
    fontSize: 13,
  },
});