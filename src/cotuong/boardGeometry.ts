export const COTUONG_BOARD_VIEWBOX = {
  width: 800,
  height: 900,
  left: 50,
  right: 750,
  top: 50,
  bottom: 850,
  columns: 9,
  rows: 10,
} as const;

export type CotuongBoardGeometry = {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
};

/** Grid tracks are centered on the same intersections as the SVG board. */
export function getCotuongBoardGeometry(): CotuongBoardGeometry {
  const columnStep = (COTUONG_BOARD_VIEWBOX.right - COTUONG_BOARD_VIEWBOX.left)
    / (COTUONG_BOARD_VIEWBOX.columns - 1) / COTUONG_BOARD_VIEWBOX.width;
  const rowStep = (COTUONG_BOARD_VIEWBOX.bottom - COTUONG_BOARD_VIEWBOX.top)
    / (COTUONG_BOARD_VIEWBOX.rows - 1) / COTUONG_BOARD_VIEWBOX.height;
  const left = COTUONG_BOARD_VIEWBOX.left / COTUONG_BOARD_VIEWBOX.width;
  const top = COTUONG_BOARD_VIEWBOX.top / COTUONG_BOARD_VIEWBOX.height;

  return {
    leftPercent: (left - columnStep / 2) * 100,
    topPercent: (top - rowStep / 2) * 100,
    widthPercent: columnStep * COTUONG_BOARD_VIEWBOX.columns * 100,
    heightPercent: rowStep * COTUONG_BOARD_VIEWBOX.rows * 100,
  };
}

export function getCotuongPointCenter(row: number, col: number) {
  if (!Number.isInteger(row) || row < 0 || row >= COTUONG_BOARD_VIEWBOX.rows) throw new RangeError('Cờ tướng có 10 hàng.');
  if (!Number.isInteger(col) || col < 0 || col >= COTUONG_BOARD_VIEWBOX.columns) throw new RangeError('Cờ tướng có 9 cột.');

  return {
    xPercent: (COTUONG_BOARD_VIEWBOX.left + col * ((COTUONG_BOARD_VIEWBOX.right - COTUONG_BOARD_VIEWBOX.left) / (COTUONG_BOARD_VIEWBOX.columns - 1))) / COTUONG_BOARD_VIEWBOX.width * 100,
    yPercent: (COTUONG_BOARD_VIEWBOX.top + row * ((COTUONG_BOARD_VIEWBOX.bottom - COTUONG_BOARD_VIEWBOX.top) / (COTUONG_BOARD_VIEWBOX.rows - 1))) / COTUONG_BOARD_VIEWBOX.height * 100,
  };
}

