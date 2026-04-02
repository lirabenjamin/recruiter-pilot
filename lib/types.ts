export type FlatPair = {
  id: string;
  essay_a_id: string;
  essay_b_id: string;
  essay_a: string;
  essay_b: string;
};

// Returned to the client when we claim a pair
export type ClaimedPair = {
  assignmentId: string;
  pairId: string;
  leftHtml: string;
  rightHtml: string;
};

// Result submission payload type (optional, just for clarity)
export type SubmitChoice = 'left' | 'right' | 'tie';
