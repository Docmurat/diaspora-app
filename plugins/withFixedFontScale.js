// Минги-Тау · Иммунитет к системным настройкам масштаба — НА УРОВНЕ
// КОРОБКИ (Веха 68; усилен 12.09 и 26.09 после прогонов владельца).
//
// У Android ДВЕ ручки в спецвозможностях, и запирать надо обе:
//   • «Размер шрифта» (fontScale) — растит только тексты;
//   • «Размер изображения на экране» (densityDpi) — растит ВСЁ:
//     кнопки, отступы, картинки — от неё «плывёт дизайн».
// История: приём Вехи 66 (Text.defaultProps.allowFontScaling=false)
// умер в React 19. Первая версия плагина запирала fontScale только в
// MainActivity — движку RN мало: метрики он берёт из контекста
// ПРИЛОЖЕНИЯ. Вторая заперла шрифт в Application (сработало — тексты
// держатся, прогон 26.09), но экранный масштаб оставался. Теперь оба
// замка стоят в трёх местах:
//   1) MainApplication.attachBaseContext — главный;
//   2) MainApplication.onConfigurationChanged — смена настроек на лету;
//   3) MainActivity.attachBaseContext — страховка на уровне экрана.
// densityDpi запирается на DENSITY_DEVICE_STABLE — родную плотность
// устройства, какой бы масштаб ни выбрал человек в настройках.
// Работает только в собранном APK; сайту не нужен и не мешает.
const {
  withMainActivity,
  withMainApplication,
} = require("expo/config-plugins");

const ACTIVITY_METHOD = `
  // Минги-Тау: замок масштаба шрифта и экрана (plugins/withFixedFontScale.js)
  override fun attachBaseContext(newBase: android.content.Context) {
    val scaleLock = android.content.res.Configuration(newBase.resources.configuration)
    scaleLock.fontScale = 1.0f
    scaleLock.densityDpi = android.util.DisplayMetrics.DENSITY_DEVICE_STABLE
    super.attachBaseContext(newBase.createConfigurationContext(scaleLock))
  }
`;

const APPLICATION_METHOD = `
  // Минги-Тау: замок масштаба шрифта и экрана (plugins/withFixedFontScale.js)
  override fun attachBaseContext(base: android.content.Context) {
    val scaleLock = android.content.res.Configuration(base.resources.configuration)
    scaleLock.fontScale = 1.0f
    scaleLock.densityDpi = android.util.DisplayMetrics.DENSITY_DEVICE_STABLE
    super.attachBaseContext(base.createConfigurationContext(scaleLock))
  }
`;

function insertAfter(src, anchorRe, method, where) {
  if (!anchorRe.test(src)) {
    throw new Error(
      `withFixedFontScale: не нашёл ${where} — шаблон Expo изменился, плагин нужно поправить`,
    );
  }
  return src.replace(anchorRe, (m) => `${m}\n${method}`);
}

module.exports = function withFixedFontScale(config) {
  config = withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error("withFixedFontScale: ожидал MainApplication на Kotlin");
    }
    let src = cfg.modResults.contents;

    if (!src.includes("createConfigurationContext")) {
      // Замок 1: контекст всего приложения.
      src = insertAfter(
        src,
        /class MainApplication : Application\(\), ReactApplication \{/,
        APPLICATION_METHOD,
        "'class MainApplication : Application(), ReactApplication {'",
      );

      // Замок 2: смена настроек на лету — гасим масштабы в приходящей
      // конфигурации. Если шаблон без этого метода — пропускаем,
      // замков 1 и 3 достаточно.
      src = src.replace(
        /override fun onConfigurationChanged\(newConfig: Configuration\) \{/,
        (m) =>
          `${m}\n    newConfig.fontScale = 1.0f\n    newConfig.densityDpi = android.util.DisplayMetrics.DENSITY_DEVICE_STABLE`,
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  config = withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error("withFixedFontScale: ожидал MainActivity на Kotlin");
    }
    if (!cfg.modResults.contents.includes("createConfigurationContext")) {
      cfg.modResults.contents = insertAfter(
        cfg.modResults.contents,
        /class MainActivity : ReactActivity\(\) \{/,
        ACTIVITY_METHOD,
        "'class MainActivity : ReactActivity() {'",
      );
    }
    return cfg;
  });

  return config;
};