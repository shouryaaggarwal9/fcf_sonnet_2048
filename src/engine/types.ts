export type Direction = 'up' | 'down' | 'left' | 'right';

/** A single row (or column) of tile values. 0 means empty. */
export type Row = readonly number[];

/** A square grid stored as rows. Tile values are 2, 4, 8, ... and 0 means empty. */
export type Board = readonly Row[];
