<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\DeleteRoomAction;
use App\Http\Requests\JoinRoomRequest;
use App\Http\Requests\StoreRoomRequest;
use App\Http\Requests\UpdateRoomRequest;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\NullStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class RoomController extends Controller
{
    public function index(Request $request): Response
    {
        $rooms = Room::query()
            ->whereHas('members', fn ($q) => $q->where('user_id', $request->user()->id))
            ->orWhere('user_id', $request->user()->id)
            ->with('owner:id,name')
            ->withCount('members')
            ->latest('last_activity_at')
            ->get();

        return Inertia::render('Dashboard', [
            'rooms' => $rooms,
        ]);
    }

    public function store(StoreRoomRequest $request): RedirectResponse
    {
        $this->authorize('create', Room::class);

        $cacheStore = Cache::getStore();

        if (app()->isProduction()
            && ($cacheStore instanceof ArrayStore || $cacheStore instanceof NullStore)) {
            Log::critical(
                'Room cap lock is not cross-process safe with the configured cache store.',
                ['store' => $cacheStore::class],
            );

            return back()
                ->withInput()
                ->withErrors(['name' => 'سرور مشغول است. لطفاً کمی بعد دوباره تلاش کنید.']);
        }

        $lock = Cache::lock('room-cap', 10);

        if (! $lock->get()) {
            return back()
                ->withInput()
                ->withErrors(['name' => 'سرور مشغول است. لطفاً کمی بعد دوباره تلاش کنید.']);
        }

        try {
            $activeCount = Room::where('last_activity_at', '>', now()->subHours(2))
                ->count();

            $maxConcurrent = config('tamasharoom.max_concurrent_rooms', 50);

            if ($activeCount >= $maxConcurrent) {
                return back()
                    ->withInput()
                    ->withErrors(['name' => 'سرور در حال حاضر ظرفیت کامل دارد. لطفاً بعداً تلاش کنید.']);
            }

            $room = Room::create([
                'user_id' => $request->user()->id,
                'name' => $request->name,
                'invite_code' => Room::generateInviteCode(),
                'max_members' => $request->max_members ?? 10,
                'last_activity_at' => now(),
            ]);

            RoomMember::create([
                'room_id' => $room->id,
                'user_id' => $request->user()->id,
                'last_seen_at' => now(),
                'presence_status' => 'online',
                'joined_at' => now(),
            ]);

            return to_route('rooms.show', $room);
        } finally {
            $lock->release();
        }
    }

    public function show(Request $request, Room $room): Response
    {
        $this->authorize('view', $room);

        $room->load([
            'owner:id,name',
            'members.user:id,name',
            'chatMessages.user:id,name',
        ]);

        return Inertia::render('Rooms/Show', [
            'room' => $room,
        ]);
    }

    public function join(JoinRoomRequest $request, string $inviteCode): RedirectResponse
    {
        return DB::transaction(function () use ($request, $inviteCode) {
            $room = Room::query()->lockForUpdate()
                ->where('invite_code', $inviteCode)
                ->firstOrFail();

            $this->authorize('join', $room);

            RoomMember::create([
                'room_id' => $room->id,
                'user_id' => $request->user()->id,
                'last_seen_at' => now(),
                'presence_status' => 'online',
                'joined_at' => now(),
            ]);

            $room->touchActivity();

            return to_route('rooms.show', $room);
        });
    }

    public function members(Request $request, Room $room): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        $room->load('members.user:id,name');

        $room->members->each->setRelation('room', $room);

        return response()->json($room->members);
    }

    public function update(UpdateRoomRequest $request, Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        $room->update($request->validated());
        $room->touchActivity();

        return response()->json([
            'status' => 'ok',
            'room' => $room->fresh()->load('owner:id,name'),
        ]);
    }

    public function destroy(Request $request, Room $room, DeleteRoomAction $deleteRoom): RedirectResponse
    {
        $this->authorize('delete', $room);

        $deleteRoom->execute($room);

        return to_route('dashboard');
    }

    public function kick(Request $request, Room $room, int $targetId): JsonResponse
    {
        $target = User::find($targetId);

        if ($target === null) {
            abort(404);
        }

        $this->authorize('kick', [$room, $target]);

        $room->members()->where('user_id', $target->id)->delete();

        return response()->json(['status' => 'ok']);
    }

    public function transfer(Request $request, Room $room, int $targetId): JsonResponse
    {
        $target = User::find($targetId);

        if ($target === null) {
            abort(404);
        }

        $this->authorize('transfer', $room);

        $room->members()->where('user_id', $target->id)->firstOrFail();

        $room->update(['user_id' => $target->id]);

        return response()->json(['status' => 'ok']);
    }

    public function regenerateInviteCode(Request $request, Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        $room->update([
            'invite_code' => Room::generateInviteCode(),
        ]);

        return response()->json([
            'status' => 'ok',
            'invite_code' => $room->fresh()->invite_code,
        ]);
    }

    public function toggleLock(Request $request, Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        $room->update([
            'is_locked' => ! $room->is_locked,
        ]);

        return response()->json([
            'status' => 'ok',
            'is_locked' => $room->fresh()->is_locked,
        ]);
    }
}
