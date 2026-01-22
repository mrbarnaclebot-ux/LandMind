/**
 * BottomSheet - Swipeable bottom sheet panel for mobile UI
 *
 * Wraps react-modal-sheet with pixel theme styling.
 * Used for mobile navigation panels (agents, earnings, settings).
 */
import { Sheet } from 'react-modal-sheet';
import { ReactNode } from 'react';
import '../../styles/mobile.css';

interface BottomSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Called when sheet should close */
  onClose: () => void;
  /** Sheet content */
  children: ReactNode;
  /** Optional title shown in header */
  title?: string;
  /** Snap points as fractions of viewport height (ascending order, starting with 0). Default: [0, 0.25, 0.5, 0.9] */
  snapPoints?: number[];
}

/**
 * BottomSheet component with Minecraft pixel theme
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0, 0.25, 0.5, 0.9],
}: BottomSheetProps) {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnap={2} // Start at 0.5 (50% height)
    >
      <Sheet.Container className="bottom-sheet-container">
        <Sheet.Header className="bottom-sheet-header">
          <div className="bottom-sheet-handle" />
          {title && <div className="bottom-sheet-title">{title}</div>}
        </Sheet.Header>
        <Sheet.Content className="bottom-sheet-content">
          <div style={{ overflowY: 'auto', height: '100%' }}>{children}</div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
