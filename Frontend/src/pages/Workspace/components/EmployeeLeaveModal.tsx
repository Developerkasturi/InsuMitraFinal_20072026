import React from 'react';
import Modal from '@comps/common/Modal';
import EmployeeLeavePanel from './EmployeeLeavePanel';

interface EmployeeLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId?: string | null;
  employeeName?: string;
}

export default function EmployeeLeaveModal({
  isOpen,
  onClose,
  employeeId,
  employeeName
}: EmployeeLeaveModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="🌴 Mark Absence &amp; Apply Leave"
      size="xl"
    >
      <div className="pt-1">
        <EmployeeLeavePanel
          employeeId={employeeId}
          employeeName={employeeName}
          isViewOnly={false}
        />
      </div>
    </Modal>
  );
}
