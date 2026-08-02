// Локации «Минги-Тау»: человек может жить в нескольких странах и городах.
// Храним пары в существующих полях users.country и users.city списками
// через запятую В ОДИНАКОВОМ ПОРЯДКЕ: первая страна соответствует первому
// городу («Россия, Турция» + «Москва, Стамбул» = Москва (Россия) и
// Стамбул (Турция)). База не меняется, поиск по вхождению текста
// продолжает находить и по городу, и по стране. Порядок гарантирует
// интерфейс ввода (LocationFields) — руками эти поля никто не редактирует.

import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export type LocationPair = { country: string; city: string };

function splitList(value?: string | null): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Поля из базы → пары. Если у старой записи городов больше, чем стран
// (или наоборот), недостающая страна берётся последней известной.
export function parseLocations(
  country?: string | null,
  city?: string | null,
): LocationPair[] {
  const countries = splitList(country);
  const cities = splitList(city);
  const length = Math.max(countries.length, cities.length, 1);

  const pairs: LocationPair[] = [];

  for (let i = 0; i < length; i++) {
    pairs.push({
      country: countries[i] ?? countries[countries.length - 1] ?? "",
      city: cities[i] ?? "",
    });
  }

  return pairs;
}

// Пары → два поля для сохранения в базу (пустые пары отбрасываются)
export function joinLocations(pairs: LocationPair[]): {
  country: string;
  city: string;
} {
  const filled = pairs
    .map((pair) => ({ country: pair.country.trim(), city: pair.city.trim() }))
    .filter((pair) => pair.country || pair.city);

  return {
    country: filled.map((pair) => pair.country).join(", "),
    city: filled.map((pair) => pair.city).join(", "),
  };
}

// Проверка формы: есть хотя бы одна пара, и ни одна начатая пара
// не заполнена наполовину (город без страны или наоборот)
export function locationsValid(pairs: LocationPair[]): boolean {
  const touched = pairs.filter(
    (pair) => pair.country.trim() || pair.city.trim(),
  );

  if (touched.length === 0) return false;

  return touched.every((pair) => pair.country.trim() && pair.city.trim());
}

// Красивый показ: «Москва (Россия) · Стамбул (Турция)»
export function formatLocations(
  country?: string | null,
  city?: string | null,
): string {
  const pairs = parseLocations(country, city).filter(
    (pair) => pair.country || pair.city,
  );

  if (pairs.length === 0) return "";

  return pairs
    .map((pair) => {
      if (pair.city && pair.country) return `${pair.city} (${pair.country})`;
      return pair.city || pair.country;
    })
    .join(" · ");
}

// Первый (основной) город — для короткой подписи под именем
export function firstCity(city?: string | null): string {
  return splitList(city)[0] || "";
}

// Блок полей «Локации» для форм: пары «Страна + Город»,
// кнопка «Добавить», у дополнительных пар — «Убрать».
export function LocationFields({
  pairs,
  onChange,
}: {
  pairs: LocationPair[];
  onChange: (next: LocationPair[]) => void;
}) {
  const updatePair = (
    index: number,
    field: "country" | "city",
    value: string,
  ) => {
    onChange(
      pairs.map((pair, i) =>
        i === index ? { ...pair, [field]: value } : pair,
      ),
    );
  };

  const addPair = () => {
    onChange([...pairs, { country: "", city: "" }]);
  };

  const removePair = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index));
  };

  return (
    <View>
      {pairs.map((pair, index) => (
        <View key={index}>
          {index > 0 && (
            <View style={s.pairHeader}>
              <Text style={s.pairLabel}>ЕЩЁ ОДНА ЛОКАЦИЯ</Text>

              <TouchableOpacity
                onPress={() => removePair(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.8}
              >
                <Text style={s.removeText}>Убрать</Text>
              </TouchableOpacity>
            </View>
          )}

          <TextInput
            placeholder="Страна *"
            placeholderTextColor="#8FA79A"
            style={s.input}
            value={pair.country}
            onChangeText={(text) => updatePair(index, "country", text)}
          />

          <TextInput
            placeholder="Город *"
            placeholderTextColor="#8FA79A"
            style={s.input}
            value={pair.city}
            onChangeText={(text) => updatePair(index, "city", text)}
          />
        </View>
      ))}

      <TouchableOpacity
        onPress={addPair}
        activeOpacity={0.8}
        style={s.addButton}
      >
        <Text style={s.addButtonText}>
          ＋ Живу ещё в одной стране / городе
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  input: {
    minHeight: 52,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    fontSize: 15.5,
    color: "#2F4A3C",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },

  pairHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  pairLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#719686",
  },

  removeText: {
    fontSize: 13,
    color: "#96AC9E",
    textDecorationLine: "underline",
  },

  addButton: {
    alignSelf: "flex-start",
    marginTop: -2,
    marginBottom: 14,
    paddingHorizontal: 4,
  },

  addButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },
});
