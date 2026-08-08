// Мостик между экраном Меморандума и регистрацией: галочку «Меморандум
// принят» нельзя поставить руками — только кнопкой «Принимаю» в конце
// текста. Экран меморандума поднимает флаг, регистрация читает его при
// возвращении (useFocusEffect) и зажигает галочку.

let memorandumAccepted = false;

export function getMemorandumAccepted(): boolean {
  return memorandumAccepted;
}

export function setMemorandumAccepted(value: boolean): void {
  memorandumAccepted = value;
}
