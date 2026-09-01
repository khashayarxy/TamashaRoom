<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DeleteRoomAction
{
    /**
     * Delete a room and all its associated data.
     *
     * Disk file deletion (Storage::delete) runs *before* the DB transaction
     * by design: if the transaction later rolls back, missing files on disk
     * are safer than orphaned files referencing nothing.
     */
    public function execute(Room $room): void
    {
        if (! $room->relationLoaded('subtitleTracks')) {
            $room->load('subtitleTracks');
        }

        $this->deleteFilesForRooms(collect([$room]));

        DB::transaction(function () use ($room): void {
            $room->subtitleTracks()->delete();
            $room->chatMessages()->delete();
            $room->members()->delete();
            $room->delete();
        });
    }

    /**
     * Delete subtitle files on disk for every room owned by the user.
     *
     * Room/SubtitleTrack rows cascade-delete via FK when the user is deleted,
     * but the stored files would be orphaned unless removed here first.
     *
     * Filesystem operations are not transactional: missing files are harmless,
     * failed deletions are logged, and the DB deletion always proceeds so
     * account deletion is never blocked by a storage error.
     */
    public function deleteFilesForOwnedRooms(User $user): void
    {
        $rooms = Room::query()
            ->where('user_id', $user->id)
            ->with('subtitleTracks')
            ->get();

        $this->deleteFilesForRooms($rooms);
    }

    /**
     * Subtitle files live on the non-public `local` disk so they are never
     * web-accessible; see SubtitleController::SUBTITLE_DISK.
     */
    private const SUBTITLE_DISK = 'local';

    /**
     * @param  Collection<int, Room>  $rooms
     */
    private function deleteFilesForRooms(Collection $rooms): void
    {
        foreach ($rooms as $room) {
            foreach ($room->subtitleTracks as $subtitle) {
                $path = $subtitle->file_path;

                if (! Storage::disk(self::SUBTITLE_DISK)->exists($path)) {
                    continue;
                }

                if (! Storage::disk(self::SUBTITLE_DISK)->delete($path)) {
                    Log::warning('Failed to delete subtitle file.', [
                        'room_id' => $room->id,
                        'path' => $path,
                    ]);
                }
            }
        }
    }
}
