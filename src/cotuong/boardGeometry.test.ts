import { describe, expect, it } from 'vitest';
import { COTUONG_BOARD_VIEWBOX, getCotuongBoardGeometry, getCotuongPointCenter } from './boardGeometry';

describe('Cờ tướng board geometry', () => {
  it('aligns the hit-grid track centers with all 90 SVG intersections', () => {
    const geometry = getCotuongBoardGeometry();
    const stepX = geometry.widthPercent / COTUONG_BOARD_VIEWBOX.columns;
    const stepY = geometry.heightPercent / COTUONG_BOARD_VIEWBOX.rows;

    for (let row = 0; row < COTUONG_BOARD_VIEWBOX.rows; row++) {
      for (let col = 0; col < COTUONG_BOARD_VIEWBOX.columns; col++) {
        const expected = getCotuongPointCenter(row, col);
        expect(geometry.leftPercent + stepX * (col + .5)).toBeCloseTo(expected.xPercent, 8);
        expect(geometry.topPercent + stepY * (row + .5)).toBeCloseTo(expected.yPercent, 8);
      }
    }
  });

  it('keeps the four corner intersections inside the board art', () => {
    expect(getCotuongPointCenter(0, 0)).toEqual({ xPercent: 6.25, yPercent: 5.555555555555555 });
    expect(getCotuongPointCenter(0, 8).xPercent).toBe(93.75);
    expect(getCotuongPointCenter(9, 0).yPercent).toBeCloseTo(94.44444444444444, 8);
    expect(getCotuongPointCenter(9, 8).xPercent).toBe(93.75);
  });
});
