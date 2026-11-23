"use client";

import type { ReactNode } from "react";
import { Button, Modal } from "@heroui/react";

/**
 * Required before every money or permission action
 * (approve, reject, freeze, reverse, block ...).
 */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "primary",
  isLoading,
  onConfirm,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {description && <div className="text-sm text-kosh-muted">{description}</div>}
            {children}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={() => onOpenChange(false)} isDisabled={isLoading}>
              Cancel
            </Button>
            <Button variant={tone} onPress={() => onConfirm()} isPending={isLoading}>
              {confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
