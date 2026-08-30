import type { PresenceMember } from "@/Hooks/use-presence";
import { useEffect, useRef, useState } from "react";

const LOCAL_TRANSFER_COOLDOWN = 10_000;

interface UseRoomOwnershipOptions {
    initialOwnerId: number;
    currentUserId: number;
    presenceMembers: PresenceMember[];
}

export function useRoomOwnership({
    initialOwnerId,
    currentUserId,
    presenceMembers,
}: UseRoomOwnershipOptions) {
    const [ownerId, setOwnerId] = useState(initialOwnerId);
    const localTransferAtRef = useRef(0);

    useEffect(() => {
        const presenceOwner = presenceMembers.find((member) => member.is_owner);
        if (!presenceOwner) return;

        const recentlyTransferred =
            Date.now() - localTransferAtRef.current < LOCAL_TRANSFER_COOLDOWN;
        if (recentlyTransferred && presenceOwner.user_id !== ownerId) return;

        if (presenceOwner.user_id !== ownerId) {
            setOwnerId(presenceOwner.user_id);
        }
    }, [presenceMembers, ownerId, setOwnerId]);

    const transferOwnership = (newOwnerId: number) => {
        localTransferAtRef.current = Date.now();
        setOwnerId(newOwnerId);
    };

    const effectiveOwnerId = ownerId || initialOwnerId;
    const isOwner = currentUserId === effectiveOwnerId;

    return { ownerId: effectiveOwnerId, isOwner, transferOwnership };
}
