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
  /** Snap points as fractions of viewport height. Default: [0.9, 0.5, 0.25] */
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
  snapPoints = [0.9, 0.5, 0.25],
}: BottomSheetProps) {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnap={1} // Start at middle snap (0.5)
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
