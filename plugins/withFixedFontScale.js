// Минги-Тау · Иммунитет к системному увеличению шрифта — НА УРОВНЕ
// КОРОБКИ (Веха 68, 11.09.2026).
//
// История: в Вехе 66 иммунитет ставили старым приёмом
// (Text.defaultProps.allowFontScaling = false в app/_layout.tsx), но
// React 19 убрал поддержку defaultProps — телефон приём игнорирует,
// и при крупном системном шрифте вёрстка плыла (поймано владельцем
// на APK v2). Этот плагин чинит на уровень ниже: при сборке коробки
// Expo впишет в Android-активность замок, и приложение всегда будет
// видеть масштаб шрифта = 1, что бы ни стояло в спецвозможностях.
// Работает только в собранном APK; на сайт не влияет и не нужен.
const { withMainActivity } = require("expo/config-plugins");

const METHOD = `
  // Минги-Тау: замок на системный масштаб шрифта (см. plugins/withFixedFontScale.js)
  override fun attachBaseContext(newBase: android.content.Context) {
    super.attachBaseContext(newBase)
    val fontLock = android.content.res.Configuration(newBase.resources.configuration)
    fontLock.fontScale = 1.0f
    applyOverrideConfiguration(fontLock)
  }
`;

function addFontScaleLock(src) {
  // Уже вписан (повторный prebuild) — ничего не делаем.
  if (src.includes("applyOverrideConfiguration")) return src;

  const anchor = /class MainActivity : ReactActivity\(\) \{/;
  if (!anchor.test(src)) {
    throw new Error(
      "withFixedFontScale: не нашёл 'class MainActivity : ReactActivity() {' — " +
        "шаблон Expo изменился, плагин нужно поправить",
    );
  }
  return src.replace(anchor, (m) => `${m}\n${METHOD}`);
}

module.exports = function withFixedFontScale(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error("withFixedFontScale: ожидал MainActivity на Kotlin");
    }
    cfg.modResults.contents = addFontScaleLock(cfg.modResults.contents);
    return cfg;
  });
};
