'use client';
import type { ReactNode } from 'react';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { Dialog as Primitive } from '@base-ui/react/dialog';

export function GameModal({ open, onClose, title, className, children }: {
  open: boolean; onClose: () => void; title: string; className: string; children: ReactNode;
}) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogPortal>
      <DialogOverlay className="game-modal-overlay" />
      <Primitive.Popup className={`game-modal ${className}`}>
        <DialogTitle>{title}</DialogTitle>
        {children}
      </Primitive.Popup>
    </DialogPortal>
  </Dialog>;
}
