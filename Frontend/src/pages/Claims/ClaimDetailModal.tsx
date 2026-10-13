import { useQuery } from '@tanstack/react-query';
import { claimsService } from '@api/index';
import Modal from '@comps/common/Modal';
import { ClaimDetailView } from './index';

interface Props {
  open: boolean;
  claim: any | null;
  onClose: () => void;
  zIndexClass?: string;
}

export default function ClaimDetailModal({ open, claim, onClose, zIndexClass = 'z-[70]' }: Props) {
  const claimId = claim?.id;

  const { data: fullClaimRes } = useQuery({
    queryKey: ['claim-detail-modal', claimId],
    queryFn: () => claimsService.get(claimId!),
    enabled: open && !!claimId,
    staleTime: 30000,
  });

  if (!open || !claim) return null;

  const displayClaim = fullClaimRes?.data || fullClaimRes || claim;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Claim Details"
      subtitle={displayClaim?.claimNumber || undefined}
      size="2xl"
      zIndexClass={zIndexClass}
    >
      <div className="max-h-[80vh] overflow-y-auto custom-scrollbar py-2 px-1">
        <ClaimDetailView claim={displayClaim} />
      </div>
    </Modal>
  );
}
