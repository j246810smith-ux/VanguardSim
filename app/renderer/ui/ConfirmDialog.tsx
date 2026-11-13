/**
 * The game's own yes/no question, in place of the browser's window.confirm (U10): it matches the
 * game's look and works the same on Windows and Android. Clicking outside it, or Android's back
 * button, means "no".
 */
import { useState } from 'react';
import { Button, Dialog } from './kit';

export interface Question {
  readonly message: string;
  /** The "yes" button's words, e.g. "Delete". */
  readonly yes: string;
  readonly onYes: () => void;
}

/** A UI kit dialog (docs/design/UI_COMPONENT_SYSTEM.md); Escape, outside and back mean "no". */
export function ConfirmDialog({ question, onClose }: { question: Question; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={question.message}
      testId="confirm-dialog"
      actions={
        <>
          <Button
            variant="gold"
            onClick={() => {
              onClose();
              question.onYes();
            }}
            data-testid="confirm-yes"
          >
            {question.yes}
          </Button>
          <Button onClick={onClose} data-testid="confirm-no">
            Cancel
          </Button>
        </>
      }
    />
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
