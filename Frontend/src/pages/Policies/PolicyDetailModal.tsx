import Modal from '@comps/common/Modal';
import PolicyDetail from './PolicyDetail';

interface Props {
  open: boolean;
  policyId: string | null;
  onClose: () => void;
}

export default function PolicyDetailModal({ open, policyId, onClose }: Props) {
  if (!open || !policyId) return null;
  return (
    <Modal open={open} onClose={onClose} title="Policy Details" size="2xl">
      <div className="py-2 px-1 max-h-[80vh] overflow-y-auto custom-scrollbar">
        <PolicyDetail policyId={policyId} onClose={onClose} isModal />
      </div>
    </Modal>
  );
}
