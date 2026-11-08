/**
 * The game's own yes/no question, in place of the browser's window.confirm (U10): it matches the
 * game's look and works the same on Windows and Android. Clicking outside it, or Android's back
 * button, means "no".
 */
import { useState } from 'react';
import { useBackHandler } from '../android/back';

export interface Question {
  readonly message: string;
  /** The "yes" button's words, e.g. "Delete". */
  readonly yes: string;
  readonly onYes: () => void;
}

export function ConfirmDialog({ question, onClose }: { question: Question; onClose: () => void }) {
  useBackHandler(() => {
    onClose();
    return true;
  });
  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="confirm-dialog">
      <div className="modal deck-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{question.message}</h2>
        <div className="buttons">
          <button
            className="btn gold"
            autoFocus
            onClick={() => {
              onClose();
              question.onYes();
            }}
            data-testid="confirm-yes"
          >
            {question.yes}
          </button>
          <button className="btn" onClick={onClose} data-testid="confirm-no">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** A question to show (null: none) and `ask` to show one. */
export function useConfirm() {
  const [question, setQuestion] = useState<Question | null>(null);
  const ask = (message: string, yes: string, onYes: () => void) =>
    setQuestion({ message, yes, onYes });
  const dialog = question ? (
    <ConfirmDialog question={question} onClose={() => setQuestion(null)} />
  ) : null;
  return { ask, dialog };
}
