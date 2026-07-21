<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Room;
use App\Services\PresenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PresenceController extends Controller
{
    public function __construct(
        private readonly PresenceService $presence,
    ) {}

    public function heartbeat(Request $request, Room $room): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        $member = $this->presence->heartbeat($room, $request->user());

        return response()->json([
            'status' => 'ok',
            'heartbeat_version' => $member->heartbeat_version,
        ]);
    }

    public function index(Request $request, Room $room): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        $members = $this->presence->getPresence($room);

        return response()->json($members);
    }

    public function leave(Request $request, Room $room): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        $this->presence->leave($room, $request->user());

        return response()->json(['status' => 'ok']);
    }
}
