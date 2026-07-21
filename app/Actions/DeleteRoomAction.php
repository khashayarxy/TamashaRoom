<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Room;
use Illuminate\Support\Facades\DB;
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
        foreach ($room->subtitleTracks as $subtitle) {
            Storage::disk('public')->delete($subtitle->file_path);
        }

        DB::transaction(function () use ($room): void {
            $room->subtitleTracks()->delete();
            $room->chatMessages()->delete();
            $room->members()->delete();
            $room->delete();
        });
    }
}
