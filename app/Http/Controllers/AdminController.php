<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            abort(403);
        }

        return response()->json([
            'total_rooms' => Room::count(),
            'active_rooms' => Room::where('last_activity_at', '>=', now()->subHour())->count(),
            'total_members' => User::count(),
        ]);
    }

    public function pruneInactive(Request $request): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            abort(403);
        }

        $count = Room::where('last_activity_at', '<', now()->subDays(7))->delete();

        return response()->json(['pruned' => $count]);
    }
}
