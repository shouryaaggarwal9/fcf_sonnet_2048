import { reverseRows, transpose } from './board';
import { slideRow } from './slide';
import type { Board, Direction } from './types';

export interface MoveResult {
  board: Board;
  /** Total points earned across all rows in this move. */
  score: number;
  /** False if nothing changed. The caller must not spawn a tile or count a turn. */
  moved: boolean;
}

function slideLeft(board: Board): MoveResult {
  let score = 0;
  let moved = false;

  const rows = board.map((row) => {
    const result = slideRow(row);
    score += result.score;
    if (result.moved) moved = true;
    return result.row;
  });

  return { board: rows, score, moved };
}

/** Applies one move to the whole board. Pure: returns a new board and never mutates. */
export function move(board: Board, direction: Direction): MoveResult {
  switch (direction) {
    case 'left':
      return slideLeft(board);

    case 'right': {
      const result = slideLeft(reverseRows(board));
      return { ...result, board: reverseRows(result.board) };
    }

    case 'up': {
      const result = slideLeft(transpose(board));
      return { ...result, board: transpose(result.board) };
    }

    case 'down': {
      const result = slideLeft(reverseRows(transpose(board)));
      return { ...result, board: transpose(reverseRows(result.board)) };
    }
  }
}
