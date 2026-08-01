// Окно кадрирования фото профиля «Минги-Тау».
// Фото можно перетаскивать и менять масштаб кнопками − / +,
// круг показывает область, которая попадёт в аватар.

import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

// До какого размера сразу уменьшаем выбранное фото (длинная сторона, px),
// чтобы не держать в памяти многомегабайтные оригиналы
const MAX_SOURCE_SIDE = 1600;

function getImageSize(uri: string) {
  return new Promise<{ w: number; h: number }>((resolve) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ w, h }),
      () => resolve({ w: 0, h: 0 }),
    );
  });
}

// Сразу после выбора фото: уменьшаем и сжимаем его,
// возвращаем лёгкую версию для окна кадрирования
export async function prepareAvatarSource(
  uri: string,
  width: number,
  height: number,
): Promise<{ uri: string; width: number; height: number }> {
  try {
    let w = width;
    let h = height;

    if (!w || !h) {
      const size = await getImageSize(uri);
      w = size.w;
      h = size.h;
    }

    if (!w || !h) {
      return { uri, width: 0, height: 0 };
    }

    if (Math.max(w, h) <= MAX_SOURCE_SIDE) {
      return { uri, width: w, height: h };
    }

    const k = MAX_SOURCE_SIDE / Math.max(w, h);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: Math.round(w * k), height: Math.round(h * k) } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );

    return { uri: result.uri, width: result.width, height: result.height };
  } catch (e) {
    console.log("prepare avatar error:", e);
    return { uri, width: width || 0, height: height || 0 };
  }
}

export default function AvatarCropModal({
  visible,
  uri,
  imageWidth,
  imageHeight,
  onCancel,
  onDone,
}: {
  visible: boolean;
  uri: string;
  imageWidth?: number;
  imageHeight?: number;
  onCancel: () => void;
  onDone: (croppedUri: string) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const S = Math.min(screenWidth - 88, 300);

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  // Актуальные значения для обработчика перетаскивания
  const zoomRef = useRef(zoom);
  const dimsRef = useRef(dims);
  const offsetRef = useRef(offset);
  const sizeRef = useRef(S);
  zoomRef.current = zoom;
  dimsRef.current = dims;
  offsetRef.current = offset;
  sizeRef.current = S;

  useEffect(() => {
    if (!visible) return;

    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setProcessing(false);

    if (imageWidth && imageHeight) {
      setDims({ w: imageWidth, h: imageHeight });
    } else if (uri) {
      Image.getSize(
        uri,
        (w, h) => setDims({ w, h }),
        () => setDims({ w: 0, h: 0 }),
      );
    }
  }, [visible, uri, imageWidth, imageHeight]);

  const clampOffset = (x: number, y: number, z: number) => {
    const d = dimsRef.current;
    const s = sizeRef.current;
    if (!d.w || !d.h) return { x: 0, y: 0 };

    const base = s / Math.min(d.w, d.h);
    const maxX = Math.max(0, (d.w * base * z - s) / 2);
    const maxY = Math.max(0, (d.h * base * z - s) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const panStart = useRef({ x: 0, y: 0 });
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          panStart.current = offsetRef.current;
        },
        onPanResponderMove: (_evt, gesture) => {
          setOffset(
            clampOffset(
              panStart.current.x + gesture.dx,
              panStart.current.y + gesture.dy,
              zoomRef.current,
            ),
          );
        },
      }),
     
    [],
  );

  const changeZoom = (delta: number) => {
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, +(zoomRef.current + delta).toFixed(2)),
    );
    setZoom(next);
    const o = offsetRef.current;
    setOffset(clampOffset(o.x, o.y, next));
  };

  const handleDone = async () => {
    if (processing) return;

    if (!dims.w || !dims.h) {
      onDone(uri);
      return;
    }

    try {
      setProcessing(true);

      const base = S / Math.min(dims.w, dims.h);
      const scale = base * zoom;
      const dispW = dims.w * scale;
      const dispH = dims.h * scale;
      const vx = S / 2 - dispW / 2 + offset.x;
      const vy = S / 2 - dispH / 2 + offset.y;

      let cropSize = Math.floor(S / scale);
      cropSize = Math.min(cropSize, dims.w, dims.h);

      let originX = Math.round(-vx / scale);
      let originY = Math.round(-vy / scale);
      originX = Math.min(Math.max(0, originX), Math.max(0, dims.w - cropSize));
      originY = Math.min(Math.max(0, originY), Math.max(0, dims.h - cropSize));

      const outSize = Math.min(512, cropSize);

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX,
              originY,
              width: cropSize,
              height: cropSize,
            },
          },
          { resize: { width: outSize, height: outSize } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      onDone(result.uri);
    } catch (e) {
      console.log("crop error:", e);
      // Если обрезать не получилось — используем исходное фото
      onDone(uri);
    } finally {
      setProcessing(false);
    }
  };

  const base = dims.w && dims.h ? S / Math.min(dims.w, dims.h) : 1;
  const dispW = dims.w * base * zoom;
  const dispH = dims.h * base * zoom;
  const vx = S / 2 - dispW / 2 + offset.x;
  const vy = S / 2 - dispH / 2 + offset.y;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Фото профиля</Text>
          <Text style={styles.hint}>
            Перетащите фото и подберите масштаб — в аватар попадёт область
            внутри круга
          </Text>

          <View
            style={[styles.viewport, { width: S, height: S }]}
            {...responder.panHandlers}
          >
            {!!uri && dims.w > 0 && dims.h > 0 && (
              <Image
                source={{ uri }}
                style={{
                  position: "absolute",
                  left: vx,
                  top: vy,
                  width: dispW,
                  height: dispH,
                }}
                resizeMode="stretch"
              />
            )}

            <View
              pointerEvents="none"
              style={[
                styles.circle,
                { width: S, height: S, borderRadius: S / 2 },
              ]}
            />
          </View>

          <View style={styles.zoomRow}>
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => changeZoom(-ZOOM_STEP)}
              activeOpacity={0.8}
            >
              <Text style={styles.zoomButtonText}>−</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => changeZoom(ZOOM_STEP)}
              activeOpacity={0.8}
            >
              <Text style={styles.zoomButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onCancel}
              disabled={processing}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>Отмена</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, processing && styles.disabled]}
              onPress={handleDone}
              disabled={processing}
              activeOpacity={0.85}
            >
              {processing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Готово</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31,52,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },

  title: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 22,
    color: "#3F6B5B",
    textAlign: "center",
  },

  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7E988B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
  },

  viewport: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#EDF5EF",
    alignSelf: "center",
  },

  circle: {
    position: "absolute",
    top: 0,
    left: 0,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },

  zoomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
  },

  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EDF5EF",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },

  zoomButtonText: {
    fontSize: 22,
    color: "#3F6B5B",
    lineHeight: 26,
  },

  buttonsRow: {
    flexDirection: "row",
    marginTop: 18,
    alignSelf: "stretch",
  },

  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 16,
    fontWeight: "600",
  },

  primaryButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    minHeight: 50,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.7,
  },
});
