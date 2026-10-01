import { reverseRows, transpose } from './board';
import { slideRowDetailed } from './slide';
import type { Board, Direction, Position, TileMove } from './types';

export interface MoveResult {
  board: Board;
  /** Total points earned across all rows in this move. */
  score: number;
  /** False if nothing changed. The caller must not spawn a tile or count a turn. */
  moved: boolean;
}

export interface DetailedMoveResult extends MoveResult {
  /** One entry per tile that was on the board. */
  moves: TileMove[];
}

/** Rearranges the board so that every move becomes "slide each row toward index 0". */
function toLines(board: Board, direction: Direction): Board {
  switch (direction) {
    case 'left':
      return board;
    case 'right':
      return reverseRows(board);
    case 'up':
      return transpose(board);
    case 'down':
      return reverseRows(transpose(board));
  }
}

/** The exact inverse of toLines. */
function fromLines(lines: Board, direction: Direction): Board {
  switch (direction) {
    case 'left':
      return lines;
    case 'right':
      return reverseRows(lines);
    case 'up':
      return transpose(lines);
    case 'down':
      return transpose(reverseRows(lines));
  }
}

/** Maps (line, index within line) in the transformed frame back to a real board cell. */
function toBoardPosition(
  direction: Direction,
  line: number,
  index: number,
  size: number,
): Position {
  switch (direction) {
    case 'left':
      return { row: line, col: index };
    case 'right':
      return { row: line, col: size - 1 - index };
    case 'up':
      return { row: index, col: line };
    case 'down':
      return { row: size - 1 - index, col: line };
  }
}

/** Applies one move and reports how every tile travelled. Pure: never mutates. */
export function moveDetailed(board: Board, direction: Direction): DetailedMoveResult {
  const size = board.length;
  const moves: TileMove[] = [];
  let score = 0;
  let moved = false;

  const slid = toLines(board, direction).map((line, lineIndex) => {
    const result = slideRowDetailed(line);
    score += result.score;
    if (result.moved) moved = true;
    for (const step of result.moves) {
      moves.push({
        from: toBoardPosition(direction, lineIndex, step.from, size),
        to: toBoardPosition(direction, lineIndex, step.to, size),
        value: step.value,
        merged: step.merged,
      });
    }
    return result.row;
  });

  return { board: fromLines(slid, direction), score, moved, moves };
}

/** Applies one move to the whole board. Pure: returns a new board and never mutates. */
export function move(board: Board, direction: Direction): MoveResult {
  const { board: next, score, moved } = moveDetailed(board, direction);
  return { board: next, score, moved };
}
